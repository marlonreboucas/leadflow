import { Module } from '@nestjs/common';
import { AiAgentsService } from './ai-agents.service';
import { AiAgentsController } from './ai-agents.controller';
import { AiRuntimeModule } from '../ai-runtime/ai-runtime.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AiRuntimeModule, BillingModule],
  controllers: [AiAgentsController],
  providers: [AiAgentsService],
  exports: [AiAgentsService],
})
export class AiAgentsModule {}
