import { Controller, Delete, Get, Query, Redirect } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(private readonly google: GoogleCalendarService) {}

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('status')
  status(@CurrentUser('companyId') companyId: string) {
    return this.google.status(companyId);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('auth-url')
  authUrl(@CurrentUser('companyId') companyId: string) {
    return { url: this.google.getAuthUrl(companyId) };
  }

  @Public()
  @Get('callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string) {
    await this.google.handleCallback(state, code);
    const app = (process.env.APP_URL ?? 'http://localhost:3000').split(',')[0];
    return { url: `${app}/calendar?google=connected` };
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete()
  disconnect(@CurrentUser('companyId') companyId: string) {
    return this.google.disconnect(companyId);
  }
}
