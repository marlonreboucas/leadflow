import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { InvitesService } from './invites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly invites: InvitesService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.me(user.userId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.usersService.listForCompany(companyId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('invites')
  listInvites(@CurrentUser('companyId') companyId: string) {
    return this.invites.list(companyId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post('invites')
  createInvite(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { email: string; roleSlug: string },
  ) {
    return this.invites.create(companyId, userId, body);
  }

}
