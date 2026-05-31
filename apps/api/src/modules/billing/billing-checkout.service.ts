import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';

@Injectable()
export class BillingCheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(companyId: string, planSlug: string) {
    const plan = await this.prisma.plan.findFirst({ where: { slug: planSlug, isActive: true } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripePriceId = (plan.limits as { stripePriceId?: string }).stripePriceId;
    if (stripeKey && stripePriceId) {
      return this.stripeCheckout(companyId, stripePriceId, stripeKey);
    }

    await this.activatePlan(companyId, plan.id);
    const appUrl = env.APP_URL.split(',')[0] ?? 'http://localhost:3000';
    return {
      mock: true,
      url: `${appUrl}/billing?upgraded=${plan.slug}`,
      message: 'Plano ativado (modo dev sem Stripe)',
    };
  }

  private async stripeCheckout(companyId: string, priceId: string, secretKey: string) {
    const appUrl = env.APP_URL.split(',')[0] ?? 'http://localhost:3000';
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/billing?canceled=1`,
        client_reference_id: companyId,
        'metadata[companyId]': companyId,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`Stripe: ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as { url?: string; id?: string };
    return { mock: false, url: data.url, sessionId: data.id };
  }

  async activatePlan(companyId: string, planId: string) {
    await this.prisma.subscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId,
        provider: process.env.STRIPE_SECRET_KEY ? 'STRIPE' : 'MANUAL',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600000),
      },
      update: {
        planId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600000),
      },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'ACTIVE' },
    });
  }
}
