import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';
import { syncTaskToGoogleCalendar } from '@leadflow/google-calendar';

const prisma = new PrismaClient();

type SyncJob = { companyId: string; taskId: string };

export async function processSyncGoogleCalendar(job: Job<SyncJob>) {
  await syncTaskToGoogleCalendar(prisma, job.data.companyId, job.data.taskId);
}
