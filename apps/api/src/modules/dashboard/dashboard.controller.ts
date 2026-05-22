import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get('stats')
  stats(@CurrentUser('companyId') companyId: string) {
    return this.dashboard.getStats(companyId);
  }
}
