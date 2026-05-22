import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { SendMessageDto, ListMessagesQueryDto } from './dto';

@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Get('conversations/:conversationId/messages')
  list(
    @CurrentUser('companyId') companyId: string,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messages.list(conversationId, companyId, query);
  }

  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  @Post('messages')
  send(@CurrentUser() user: AuthUser, @Body() body: SendMessageDto) {
    return this.messages.send(user.companyId, user.userId, body);
  }
}
