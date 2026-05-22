import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRuntimeService } from '../ai-runtime/ai-runtime.service';
import type { CreateAgentInput, UpdateAgentInput, CreateAgentRuleInput } from '@leadflow/shared';
import { UsageLimiterService } from '../billing/usage-limiter.service';

@Injectable()
export class AiAgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AiRuntimeService,
    private readonly limits: UsageLimiterService,
  ) {}

  async list(companyId: string) {
    return this.prisma.aiAgent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        knowledgeBases: { include: { kb: { select: { id: true, name: true } } } },
        _count: { select: { logs: true } },
      },
    });
  }

  async get(companyId: string, id: string) {
    const agent = await this.prisma.aiAgent.findFirst({
      where: { id, companyId },
      include: {
        rules: { orderBy: { position: 'asc' } },
        knowledgeBases: { include: { kb: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!agent) throw new NotFoundException('Agente não encontrado');
    return agent;
  }

  async create(companyId: string, input: CreateAgentInput) {
    await this.limits.assertCanCreateAgent(companyId);
    const { knowledgeBaseIds, ...data } = input;
    const agent = await this.prisma.aiAgent.create({
      data: { companyId, ...data },
    });
    if (knowledgeBaseIds?.length) {
      await this.prisma.aiAgentKnowledgeBase.createMany({
        data: knowledgeBaseIds.map((kbId) => ({ agentId: agent.id, kbId })),
        skipDuplicates: true,
      });
    }
    return this.get(companyId, agent.id);
  }

  async update(companyId: string, id: string, input: UpdateAgentInput) {
    await this.get(companyId, id);
    const { knowledgeBaseIds, ...data } = input;
    await this.prisma.aiAgent.update({ where: { id }, data });
    if (knowledgeBaseIds !== undefined) {
      await this.prisma.aiAgentKnowledgeBase.deleteMany({ where: { agentId: id } });
      if (knowledgeBaseIds.length) {
        await this.prisma.aiAgentKnowledgeBase.createMany({
          data: knowledgeBaseIds.map((kbId) => ({ agentId: id, kbId })),
        });
      }
    }
    return this.get(companyId, id);
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.aiAgent.delete({ where: { id } });
    return { ok: true };
  }

  async addRule(companyId: string, agentId: string, input: CreateAgentRuleInput) {
    await this.get(companyId, agentId);
    return this.prisma.aiAgentRule.create({
      data: {
        agentId,
        position: input.position,
        type: input.type,
        condition: input.condition as Prisma.InputJsonValue,
        action: input.action as Prisma.InputJsonValue,
      },
    });
  }

  async test(companyId: string, agentId: string, message: string, conversationContext?: string) {
    await this.get(companyId, agentId);
    const conv = await this.prisma.conversation.findFirst({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
    });

    if (conv) {
      return this.runtime.run({
        conversationId: conv.id,
        agentId,
        testMessage: conversationContext ? `${conversationContext}\n\n${message}` : message,
        dryRun: true,
      });
    }

    const testConvId = await this.ensureTestConversation(companyId, agentId);
    return this.runtime.run({
      conversationId: testConvId,
      agentId,
      testMessage: message,
      dryRun: true,
    });
  }

  private async ensureTestConversation(companyId: string, agentId: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({ where: { companyId } });
    const contact = await this.prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone: '5500000000000' } },
      create: { companyId, phone: '5500000000000', name: 'Playground' },
      update: {},
    });
    if (!instance) {
      throw new NotFoundException('Crie uma instância WhatsApp antes do playground');
    }
    let conv = await this.prisma.conversation.findFirst({
      where: { companyId, contactId: contact.id, instanceId: instance.id },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          companyId,
          contactId: contact.id,
          instanceId: instance.id,
          currentAgentId: agentId,
          handlingMode: 'AI_FIRST',
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: { currentAgentId: agentId },
      });
    }
    return conv.id;
  }
}
