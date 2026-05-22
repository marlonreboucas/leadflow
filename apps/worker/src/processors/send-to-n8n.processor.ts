import type { Job } from 'bullmq';
import axios from 'axios';
import crypto from 'crypto';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type N8nJob = {
  companyId: string;
  event: string;
  data: unknown;
  webhookId?: string;
};

function sign(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function processSendToN8n(job: Job<N8nJob>) {
  const { companyId, event, data } = job.data;
  const hooks = await prisma.n8nWebhook.findMany({
    where: {
      companyId,
      isActive: true,
      ...(job.data.webhookId ? { id: job.data.webhookId } : {}),
    },
  });

  const payload = JSON.stringify({ event, data, companyId, at: new Date().toISOString() });

  for (const hook of hooks) {
    const events = (hook.events as string[]) ?? [];
    if (events.length && !events.includes(event) && !events.includes('*')) continue;

    try {
      const signature = sign(payload, hook.secret);
      await axios.post(
        hook.url,
        JSON.parse(payload),
        {
          headers: {
            'Content-Type': 'application/json',
            'X-LeadFlow-Signature': signature,
            'X-LeadFlow-Event': event,
          },
          timeout: 15_000,
        },
      );
      await prisma.webhookLog.create({
        data: {
          companyId,
          direction: 'OUTBOUND',
          source: 'n8n',
          endpoint: hook.url,
          status: 200,
          payload: { event, data } as object,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'n8n failed';
      await prisma.webhookLog.create({
        data: {
          companyId,
          direction: 'OUTBOUND',
          source: 'n8n',
          endpoint: hook.url,
          status: 0,
          payload: { event, data, error: msg } as object,
        },
      });
      throw err;
    }
  }
}
