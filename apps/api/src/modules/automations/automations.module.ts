import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { QueuesModule } from '../../queues/queues.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [QueuesModule, RealtimeModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
