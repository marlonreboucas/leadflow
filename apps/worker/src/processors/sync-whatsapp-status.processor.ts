import type { Job } from 'bullmq';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type SyncJob = { companyId: string; instanceId: string };

/** Reconcilia status da instância (worker leve; API faz sync completo na listagem). */
export async function processSyncWhatsappStatus(job: Job<SyncJob>) {
  const { companyId, instanceId } = job.data;
  const instance = await prisma.whatsappInstance.findFirst({
    where: { id: instanceId, companyId },
  });
  if (!instance) return;

  const evolutionUrl = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
  const apiKey = process.env.EVOLUTION_API_KEY ?? '';
  try {
    const res = await fetch(
      `${evolutionUrl}/instance/connectionState/${encodeURIComponent(instance.externalName)}`,
      { headers: { apikey: apiKey } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { instance?: { state?: string } };
    const state = data?.instance?.state ?? (data as { state?: string }).state;
    if (!state) return;

    const status =
      state === 'open' ? 'CONNECTED' : state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';

    if (instance.status !== status) {
      await prisma.whatsappInstance.update({
        where: { id: instanceId },
        data: { status },
      });
    }
  } catch {
    // Evolution offline — ignorar
  }
}
