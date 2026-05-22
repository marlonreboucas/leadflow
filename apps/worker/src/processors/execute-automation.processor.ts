import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { runAutomationEngine, type AutomationJobPayload } from '@leadflow/automation';
import { QUEUES } from '@leadflow/shared';
import { connection } from '../redis';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

const addQueue = async (name: string, data: unknown) => {
  const q = new Queue(name, { connection });
  const job = await q.add(name, data);
  await q.close();
  return job;
};

export async function processExecuteAutomation(job: Job<AutomationJobPayload>) {
  await runAutomationEngine(prisma, addQueue, job.data);
}
