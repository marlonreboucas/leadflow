import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { Queue } from 'bullmq';
import { QUEUES } from '@leadflow/shared';
import { connection } from '../redis';

const prisma = new PrismaClient();
const idleHours = Number(process.env.AUTOMATION_IDLE_HOURS ?? 24);

export async function processIdleLeadScanner(_job: Job) {
  const cutoff = new Date(Date.now() - idleHours * 3600000);
  const deals = await prisma.deal.findMany({
    where: {
      status: 'OPEN',
      OR: [{ nextActionAt: { lt: new Date() } }, { updatedAt: { lt: cutoff } }],
    },
    take: 100,
    include: { stage: true, contact: true },
  });

  const execQ = new Queue(QUEUES.EXECUTE_AUTOMATION, { connection });

  for (const deal of deals) {
    await execQ.add(QUEUES.EXECUTE_AUTOMATION, {
      companyId: deal.companyId,
      trigger: 'LEAD_IDLE',
      context: {
        deal: {
          id: deal.id,
          title: deal.title,
          stageId: deal.stageId,
          stageName: deal.stage.name,
          temperature: deal.temperature,
          pipelineId: deal.pipelineId,
        },
        contact: { id: deal.contactId, phone: deal.contact.phone, name: deal.contact.name },
      },
    });
  }

  await execQ.close();
}
