import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { UsageLimiterService } from './usage-limiter.service';

@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [
    BillingService,
    BillingCheckoutService,
    StripeWebhookService,
    UsageLimiterService,
  ],
  exports: [UsageLimiterService],
})
export class BillingModule {}
