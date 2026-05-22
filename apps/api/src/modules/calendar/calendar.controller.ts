import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get('events')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.list(companyId, from, to);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Post('events')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body()
    body: {
      title: string;
      dueAt: string;
      durationMinutes?: number;
      description?: string;
      dealId?: string;
      conversationId?: string;
    },
  ) {
    return this.calendar.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Delete('events/:id')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.calendar.cancel(companyId, id);
  }
}
