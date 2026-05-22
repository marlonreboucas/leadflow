import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type MediaJob = {
  messageId: string;
  companyId: string;
  mediaUrl?: string;
  mimeType?: string;
};

export async function processProcessMedia(job: Job<MediaJob>) {
  const { messageId, companyId, mediaUrl, mimeType } = job.data;
  if (!mediaUrl) return;

  const message = await prisma.message.findFirst({
    where: { id: messageId, companyId },
  });
  if (!message) return;

  const type = mimeType?.startsWith('image/')
    ? 'IMAGE'
    : mimeType?.startsWith('audio/')
      ? 'AUDIO'
      : mimeType?.startsWith('video/')
        ? 'VIDEO'
        : 'DOCUMENT';

  await prisma.message.update({
    where: { id: messageId },
    data: {
      type,
      mediaUrl,
      body: message.body || `[${type}]`,
    },
  });
}
