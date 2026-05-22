import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenaiService } from '../../integrations/openai/openai.service';
import { QueuesService } from '../../queues/queues.service';
import { QUEUES } from '@leadflow/shared';
import type {
  CreateKnowledgeBaseInput,
  CreateKnowledgeItemInput,
} from '@leadflow/shared';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly queues: QueuesService,
  ) {}

  async listBases(companyId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { companyId },
      include: { _count: { select: { items: true, agents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBase(companyId: string, input: CreateKnowledgeBaseInput) {
    return this.prisma.knowledgeBase.create({ data: { companyId, ...input } });
  }

  async getBase(companyId: string, id: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id, companyId },
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });
    if (!kb) throw new NotFoundException('Base não encontrada');
    return kb;
  }

  async deleteBase(companyId: string, id: string) {
    await this.getBase(companyId, id);
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { ok: true };
  }

  async createItem(companyId: string, kbId: string, input: CreateKnowledgeItemInput) {
    await this.getBase(companyId, kbId);
    const { metadata, ...rest } = input;
    const item = await this.prisma.knowledgeItem.create({
      data: {
        kbId,
        ...rest,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.queues.add(QUEUES.INDEX_KNOWLEDGE, { itemId: item.id, companyId });
    return item;
  }

  async deleteItem(companyId: string, kbId: string, itemId: string) {
    await this.getBase(companyId, kbId);
    await this.prisma.knowledgeItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async search(kbIds: string[], query: string, topK = 5): Promise<string[]> {
    if (!kbIds.length) return [];
    try {
      const embedding = await this.openai.embed(query);
      const vector = `[${embedding.join(',')}]`;
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ title: string; content: string }>
      >(
        `SELECT title, content FROM "KnowledgeItem"
         WHERE "kbId" = ANY($1::text[]) AND embedding IS NOT NULL
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        kbIds,
        vector,
        topK,
      );
      return rows.map((r) => `${r.title}: ${r.content.slice(0, 500)}`);
    } catch {
      const items = await this.prisma.knowledgeItem.findMany({
        where: {
          kbId: { in: kbIds },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: topK,
      });
      return items.map((i) => `${i.title}: ${i.content.slice(0, 500)}`);
    }
  }

  async indexItem(itemId: string) {
    const item = await this.prisma.knowledgeItem.findUnique({
      where: { id: itemId },
      include: { kb: true },
    });
    if (!item) return;
    const text = `${item.title}\n${item.content}`;
    const embedding = await this.openai.embed(text);
    const vector = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`,
      vector,
      itemId,
    );
  }
}
