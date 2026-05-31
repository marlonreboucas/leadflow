import { Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { StripeWebhookService } from './stripe-webhook.service';

/** Só precisamos do corpo bruto (habilitado por rawBody: true no bootstrap). */
interface RawRequest {
  rawBody?: Buffer;
}

@Public()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly webhook: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawRequest,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const event = this.webhook.verifyAndParse(req.rawBody, signature);
    try {
      await this.webhook.handleEvent(event);
    } catch (err) {
      // Não devolvemos 5xx para evitar retries infinitos do Stripe em erros
      // de processamento; logamos para investigação.
      this.logger.error(`Falha ao processar ${event.type} (${event.id})`, err as Error);
    }
    return { received: true };
  }
}
