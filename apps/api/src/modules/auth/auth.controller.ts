import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, SignupDto, SwitchCompanyDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { InvitesService } from '../users/invites.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invites: InvitesService,
  ) {}

  @Public()
  @Post('signup')
  signup(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('switch-company')
  switchCompany(@CurrentUser() user: AuthUser, @Body() body: SwitchCompanyDto) {
    return this.authService.switchCompany(user.userId, body.companyId);
  }

  @Public()
  @Get('invite/:token')
  previewInvite(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Public()
  @Post('accept-invite')
  acceptInvite(
    @Body() body: { token: string; password?: string; name?: string },
  ) {
    return this.authService.acceptInvite(body);
  }
}
