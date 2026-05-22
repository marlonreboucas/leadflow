import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [RealtimeModule, DealsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
