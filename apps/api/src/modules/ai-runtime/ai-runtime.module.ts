import { Module } from '@nestjs/common';
import { AiRuntimeService } from './ai-runtime.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [AiRuntimeService],
  exports: [AiRuntimeService],
})
export class AiRuntimeModule {}
