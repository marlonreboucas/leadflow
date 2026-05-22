import { Module } from '@nestjs/common';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueuesModule } from '../../queues/queues.module';
import { DealsModule } from '../../modules/deals/deals.module';

@Module({
  imports: [PrismaModule, QueuesModule, DealsModule],
  controllers: [N8nController],
  providers: [N8nService],
  exports: [N8nService],
})
export class N8nModule {}
