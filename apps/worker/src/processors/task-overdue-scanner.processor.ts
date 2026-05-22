import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { Queue } from 'bullmq';
import { QUEUES } from '@leadflow/shared';
import { connection } from '../redis';

const prisma = new PrismaClient();

export async function processTaskOverdueScanner(_job: Job) {
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['PENDING', 'DOING'] },
      dueAt: { lt: new Date() },
    },
    take: 100,
    include: { deal: { include: { contact: true, stage: true } } },
  });

  const execQ = new Queue(QUEUES.EXECUTE_AUTOMATION, { connection });

  for (const task of tasks) {
    await execQ.add(QUEUES.EXECUTE_AUTOMATION, {
      companyId: task.companyId,
      trigger: 'TASK_OVERDUE',
      context: {
        task: { id: task.id, title: task.title },
        deal: task.deal
          ? {
              id: task.deal.id,
              title: task.deal.title,
              stageName: task.deal.stage.name,
              temperature: task.deal.temperature,
            }
          : null,
        contact: task.deal?.contact
          ? {
              id: task.deal.contact.id,
              phone: task.deal.contact.phone,
              name: task.deal.contact.name,
            }
          : undefined,
      },
    });
  }

  await execQ.close();
}
