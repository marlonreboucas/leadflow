import type { Job } from 'bullmq';
import OpenAI from 'openai';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type IndexJob = { itemId: string; companyId: string };

export async function processIndexKnowledge(job: Job<IndexJob>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;

  const item = await prisma.knowledgeItem.findUnique({ where: { id: job.data.itemId } });
  if (!item) return;

  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const res = await client.embeddings.create({
    model,
    input: `${item.title}\n${item.content}`.slice(0, 8000),
  });
  const embedding = res.data[0]?.embedding;
  if (!embedding?.length) return;

  const vector = `[${embedding.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`,
    vector,
    item.id,
  );
}
