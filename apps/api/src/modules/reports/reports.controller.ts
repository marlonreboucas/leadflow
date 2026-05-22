import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get('overview')
  overview(@CurrentUser('companyId') companyId: string) {
    return this.reports.overview(companyId);
  }
}
