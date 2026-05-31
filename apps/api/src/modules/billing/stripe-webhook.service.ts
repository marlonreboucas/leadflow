import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { BillingCheckoutService } from './billing-checkout.service';

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, any> };
};

/** Mapeia o status da subscription do Stripe para o enum interno. */
function mapStatus(stripeStatus: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'PAST_DUE';
    default:
      // canceled, incomplete_expired, paused, etc.
      return 'CANCELED';
  }
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: BillingCheckoutService,
  ) {}

  /**
   * Verifica a assinatura do webhook (esquema oficial do Stripe) e devolve o
   * evento já parseado. Lança BadRequestException quando a assinatura é inválida.
   */
  verifyAndParse(rawBody: Buffer | undefined, signatureHeader: string | undefined): StripeEvent {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('Webhook do Stripe não configurado');
    if (!rawBody) throw new BadRequestException('Corpo da requisição ausente');
    if (!signatureHeader) throw new BadRequestException('Assinatura ausente');

    const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, kv) => {
      const [k, v] = kv.split('=');
      if (k && v) (acc[k] ??= v);
      return acc;
    }, {});
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) throw new BadRequestException('Assinatura malformada');

    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new BadRequestException('Assinatura inválida');
    }

    // Tolerância de 5 min contra replay.
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (Number.isFinite(ageSeconds) && ageSeconds > 300) {
      throw new BadRequestException('Evento expirado');
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    } catch {
      throw new BadRequestException('Payload inválido');
    }
  }

  async handleEvent(event: StripeEvent): Promise<void> {
    this.logger.log(`Stripe event ${event.type} (${event.id})`);

    // Idempotência: ignora entregas duplicadas do mesmo evento. Registramos
    // após processar, para que falhas permitam retry do Stripe.
    if (event.id) {
      const seen = await this.prisma.processedWebhookEvent.findUnique({
        where: { id: event.id },
      });
      if (seen) {
        this.logger.debug(`Evento já processado: ${event.id}`);
        return;
      }
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object);
        break;
      default:
        this.logger.debug(`Stripe event ignorado: ${event.type}`);
    }

    if (event.id) {
      await this.prisma.processedWebhookEvent
        .create({ data: { id: event.id, provider: 'stripe', type: event.type } })
        .catch(() => undefined);
    }
  }

  private async onCheckoutCompleted(session: Record<string, any>): Promise<void> {
    const companyId: string | undefined =
      session.client_reference_id ?? session.metadata?.companyId;
    const planSlug: string | undefined = session.metadata?.planSlug;
    const subscriptionId: string | undefined =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!companyId || !planSlug) {
      this.logger.warn('checkout.session.completed sem companyId/planSlug nos metadados');
      return;
    }

    const plan = await this.prisma.plan.findFirst({ where: { slug: planSlug } });
    if (!plan) {
      this.logger.error(`Plano "${planSlug}" não encontrado para company ${companyId}`);
      return;
    }

    await this.checkout.activatePlan(companyId, plan.id, { externalId: subscriptionId });
    await this.logEvent(companyId, 'checkout.session.completed', session);
  }

  private async onSubscriptionUpdated(sub: Record<string, any>): Promise<void> {
    const subscription = await this.findByExternalId(sub.id);
    if (!subscription) return;

    const status = mapStatus(String(sub.status));
    const periodEnd = sub.current_period_end
      ? new Date(Number(sub.current_period_end) * 1000)
      : undefined;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      },
    });
    await this.syncCompanyStatus(subscription.companyId, status);
    await this.logEvent(subscription.companyId, 'customer.subscription.updated', sub);
  }

  private async onSubscriptionDeleted(sub: Record<string, any>): Promise<void> {
    const subscription = await this.findByExternalId(sub.id);
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELED', cancelAtPeriodEnd: true },
    });
    await this.syncCompanyStatus(subscription.companyId, 'CANCELED');
    await this.logEvent(subscription.companyId, 'customer.subscription.deleted', sub);
  }

  private async onPaymentFailed(invoice: Record<string, any>): Promise<void> {
    const subscriptionId: string | undefined =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subscriptionId) return;

    const subscription = await this.findByExternalId(subscriptionId);
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });
    await this.syncCompanyStatus(subscription.companyId, 'PAST_DUE');
    await this.logEvent(subscription.companyId, 'invoice.payment_failed', invoice);
  }

  private findByExternalId(externalId: string | undefined) {
    if (!externalId) return Promise.resolve(null);
    return this.prisma.subscription.findFirst({ where: { externalId } });
  }

  private async syncCompanyStatus(
    companyId: string,
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED',
  ): Promise<void> {
    const companyStatus =
      status === 'ACTIVE' ? 'ACTIVE' : status === 'CANCELED' ? 'CANCELED' : 'SUSPENDED';
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: companyStatus },
    });
  }

  private async logEvent(
    companyId: string,
    type: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!subscription) return;
    await this.prisma.billingEvent.create({
      data: { subscriptionId: subscription.id, type, payload: payload as object },
    });
  }
}
