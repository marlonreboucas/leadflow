import { Controller, Get, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('audit')
  audit(
    @CurrentUser('companyId') companyId: string,
    @Query('take') take?: string,
  ) {
    const n = Math.min(Number(take) || 50, 100);
    return this.logs.listAuditLogs(companyId, n);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('webhooks')
  webhooks(
    @CurrentUser('companyId') companyId: string,
    @Query('take') take?: string,
  ) {
    const n = Math.min(Number(take) || 50, 100);
    return this.logs.listWebhookLogs(companyId, n);
  }
}
