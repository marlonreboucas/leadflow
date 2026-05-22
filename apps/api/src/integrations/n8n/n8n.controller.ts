import { Body, Controller, Get, Param, Post, Req, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { N8nService } from './n8n.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('n8n')
export class N8nController {
  constructor(private readonly n8n: N8nService) {}

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Get('webhooks')
  list(@CurrentUser('companyId') companyId: string) {
    return this.n8n.listWebhooks(companyId);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post('webhooks')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() body: { name: string; url: string; events: string[] },
  ) {
    return this.n8n.createWebhook(companyId, body);
  }

  @Public()
  @Post('inbound/:companyId/:slug')
  inbound(
    @Param('companyId') companyId: string,
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-leadflow-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const raw = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
    return this.n8n.handleInbound(companyId, slug, raw, signature, body);
  }
}
