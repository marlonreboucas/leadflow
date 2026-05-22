import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { ContactsModule } from '../contacts/contacts.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueuesModule } from '../../queues/queues.module';

@Module({
  imports: [ContactsModule, RealtimeModule, QueuesModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
