import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { InvitesService } from './invites.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [UsersController],
  providers: [UsersService, InvitesService],
  exports: [UsersService, InvitesService],
})
export class UsersModule {}
