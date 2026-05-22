import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { UsageLimiterService } from './usage-limiter.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingCheckoutService, UsageLimiterService],
  exports: [UsageLimiterService],
})
export class BillingModule {}
