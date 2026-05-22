import type { PrismaClient } from '@leadflow/database';
import OpenAI from 'openai';

/** Busca top-K na base vetorial; fallback para texto se embedding indisponível. */
export async function searchKnowledgeSnippets(
  prisma: PrismaClient,
  openaiKey: string,
  kbIds: string[],
  query: string,
  topK = 6,
): Promise<string[]> {
  if (!kbIds.length || !query.trim()) return [];

  const fallback = async () => {
    const items = await prisma.knowledgeItem.findMany({
      where: {
        kbId: { in: kbIds },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: topK,
    });
    return items.map((i) => `[${i.kind}] ${i.title}: ${i.content.slice(0, 500)}`);
  };

  try {
    const client = new OpenAI({ apiKey: openaiKey });
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    const res = await client.embeddings.create({ model, input: query.slice(0, 8000) });
    const embedding = res.data[0]?.embedding;
    if (!embedding?.length) return fallback();

    const vector = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRawUnsafe<Array<{ title: string; content: string; kind: string }>>(
      `SELECT title, content, kind FROM "KnowledgeItem"
       WHERE "kbId" = ANY($1::text[]) AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      kbIds,
      vector,
      topK,
    );
    if (!rows.length) return fallback();
    return rows.map((r) => `[${r.kind}] ${r.title}: ${r.content.slice(0, 500)}`);
  } catch {
    return fallback();
  }
}
