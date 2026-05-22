import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { EvolutionWebhookController } from './webhook.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [RealtimeModule, BillingModule],
  controllers: [WhatsappController, EvolutionWebhookController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
