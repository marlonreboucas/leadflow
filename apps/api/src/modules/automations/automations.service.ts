import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import type { AutomationContext } from '@leadflow/automation';
import { runAutomationEngine } from '@leadflow/automation';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../../queues/queues.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QUEUES, SOCKET_EVENTS } from '@leadflow/shared';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '@leadflow/shared';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  list(companyId: string) {
    return this.prisma.automationRule.findMany({
      where: { companyId },
      orderBy: { runOrder: 'asc' },
      include: {
        _count: { select: { conditions: true, actions: true, executions: true } },
      },
    });
  }

  async get(companyId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, companyId },
      include: {
        conditions: true,
        actions: { orderBy: { position: 'asc' } },
        executions: { orderBy: { startedAt: 'desc' }, take: 20 },
      },
    });
    if (!rule) throw new NotFoundException('Regra não encontrada');
    return rule;
  }

  async create(companyId: string, input: CreateAutomationRuleInput) {
    const rule = await this.prisma.automationRule.create({
      data: {
        companyId,
        name: input.name,
        trigger: input.trigger as Prisma.AutomationRuleCreateInput['trigger'],
        isActive: input.isActive ?? false,
        runOrder: input.runOrder ?? 100,
        triggerConfig: input.triggerConfig as Prisma.InputJsonValue | undefined,
      },
    });
    return this.get(companyId, rule.id);
  }

  async update(companyId: string, id: string, input: UpdateAutomationRuleInput) {
    await this.get(companyId, id);
    await this.prisma.automationRule.update({
      where: { id },
      data: {
        name: input.name,
        trigger: input.trigger as Prisma.AutomationRuleUpdateInput['trigger'],
        isActive: input.isActive,
        runOrder: input.runOrder,
        triggerConfig: input.triggerConfig as Prisma.InputJsonValue | undefined,
      },
    });
    return this.get(companyId, id);
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.automationRule.delete({ where: { id } });
    return { ok: true };
  }

  async setConditions(
    companyId: string,
    ruleId: string,
    conditions: Array<{ field: string; operator: string; value?: unknown }>,
  ) {
    await this.get(companyId, ruleId);
    await this.prisma.automationCondition.deleteMany({ where: { ruleId } });
    if (conditions.length) {
      await this.prisma.automationCondition.createMany({
        data: conditions.map((c) => ({
          ruleId,
          field: c.field,
          operator: c.operator,
          value: c.value as Prisma.InputJsonValue,
        })),
      });
    }
    return this.get(companyId, ruleId);
  }

  async setActions(
    companyId: string,
    ruleId: string,
    actions: Array<{ type: string; position: number; config: Record<string, unknown> }>,
  ) {
    await this.get(companyId, ruleId);
    await this.prisma.automationAction.deleteMany({ where: { ruleId } });
    if (actions.length) {
      await this.prisma.automationAction.createMany({
        data: actions.map((a) => ({
          ruleId,
          type: a.type as Prisma.AutomationActionCreateManyInput['type'],
          position: a.position,
          config: a.config as Prisma.InputJsonValue,
        })),
      });
    }
    return this.get(companyId, ruleId);
  }

  /** Enfileira avaliação de regras (worker). */
  async enqueue(companyId: string, trigger: string, context: AutomationContext) {
    await this.queues.add(QUEUES.EXECUTE_AUTOMATION, {
      companyId,
      trigger,
      context,
    });
  }

  /** Dry-run síncrono (playground de automação). */
  async test(companyId: string, trigger: string, context: AutomationContext) {
    const addQueue = async () => ({ id: 'dry-run' });
    return runAutomationEngine(this.prisma, addQueue, {
      companyId,
      trigger,
      context,
      dryRun: true,
    });
  }

  /** Executa uma regra específica agora. */
  async runNow(companyId: string, ruleId: string, context: AutomationContext) {
    const addQueue = (name: string, data: unknown) => this.queues.add(name as never, data);
    const results = await runAutomationEngine(this.prisma, addQueue, {
      companyId,
      trigger: 'MESSAGE_RECEIVED',
      context,
      ruleId,
    });
    this.realtime.emitToCompany(companyId, SOCKET_EVENTS.AUTOMATION_EXECUTED, {
      ruleId,
      results,
    });
    return results;
  }
}
