import type { PrismaClient } from '@leadflow/database';
import { evaluateConditions } from './condition-evaluator';
import { runAction } from './action-runner';
import type {
  ActionLogEntry,
  AutomationConditionInput,
  AutomationContext,
  AutomationJobPayload,
  QueueAddFn,
} from './types';

export type EngineResult = {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  executed: boolean;
  status?: 'SUCCESS' | 'FAILED' | 'DRY_RUN';
  actionLogs?: ActionLogEntry[];
};

export async function runAutomationEngine(
  prisma: PrismaClient,
  addQueue: QueueAddFn,
  payload: AutomationJobPayload,
): Promise<EngineResult[]> {
  const { companyId, trigger, context, ruleId, dryRun } = payload;

  const rules = ruleId
    ? await prisma.automationRule.findMany({
        where: { id: ruleId, companyId },
        include: {
          conditions: true,
          actions: { orderBy: { position: 'asc' } },
        },
      })
    : await prisma.automationRule.findMany({
        where: { companyId, trigger: trigger as never, isActive: true },
        orderBy: { runOrder: 'asc' },
        include: {
          conditions: true,
          actions: { orderBy: { position: 'asc' } },
        },
      });

  const results: EngineResult[] = [];

  for (const rule of rules) {
    const conditions = rule.conditions as AutomationConditionInput[];
    const matched = evaluateConditions(conditions, context);

    if (!matched) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        executed: false,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: true,
        executed: false,
        status: 'DRY_RUN',
        actionLogs: rule.actions.map((a) => ({
          type: a.type,
          ok: true,
          message: 'dry-run',
        })),
      });
      continue;
    }

    const started = new Date();
    const actionLogs: ActionLogEntry[] = [];
    let failed = false;

    for (const action of rule.actions) {
      const log = await runAction(prisma, addQueue, companyId, action, context);
      actionLogs.push(log);
      if (!log.ok) failed = true;
    }

    await prisma.automationExecution.create({
      data: {
        ruleId: rule.id,
        companyId,
        status: failed ? 'FAILED' : 'SUCCESS',
        startedAt: started,
        endedAt: new Date(),
        triggeredBy: context as object,
        log: actionLogs as object,
      },
    });

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matched: true,
      executed: true,
      status: failed ? 'FAILED' : 'SUCCESS',
      actionLogs,
    });
  }

  return results;
}
