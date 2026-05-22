import { Body, Controller, Get, Post } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly checkout: BillingCheckoutService,
  ) {}

  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @Get('overview')
  overview(@CurrentUser('companyId') companyId: string) {
    return this.billing.overview(companyId);
  }

  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @Post('checkout')
  startCheckout(
    @CurrentUser('companyId') companyId: string,
    @Body() body: { planSlug: string },
  ) {
    return this.checkout.checkout(companyId, body.planSlug);
  }
}
