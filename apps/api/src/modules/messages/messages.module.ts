import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueuesModule } from '../../queues/queues.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [RealtimeModule, QueuesModule, BillingModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
