import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { ListConversationsQueryDto } from './dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversations.list(user.companyId, query, user.userId);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.conversations.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_ASSUME)
  @Post(':id/assume')
  assume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversations.assume(user.companyId, id, user.userId);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Post(':id/read')
  markRead(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.conversations.markRead(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_ASSUME)
  @Post(':id/ai/pause')
  pauseAi(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.conversations.pauseAi(companyId, id, body.reason);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_ASSUME)
  @Post(':id/ai/resume')
  resumeAi(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.conversations.resumeAi(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_ASSUME)
  @Post(':id/ai/run')
  runAi(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.conversations.runAi(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  @Post(':id/deals')
  createDeal(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { title: string; pipelineId?: string; valueCents?: number },
  ) {
    return this.conversations.createDeal(companyId, id, body);
  }
}
