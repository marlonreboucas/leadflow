import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('whatsapp/instances')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.whatsapp.listInstances(companyId);
  }

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Post()
  create(@CurrentUser('companyId') companyId: string) {
    return this.whatsapp.createInstance(companyId);
  }

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Get(':id/qr')
  qr(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.whatsapp.getQr(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Post(':id/restart')
  restart(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.whatsapp.restartInstance(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Post(':id/webhook')
  refreshWebhook(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.whatsapp.refreshWebhook(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.WHATSAPP_CONNECT)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.whatsapp.deleteInstance(companyId, id);
  }
}
