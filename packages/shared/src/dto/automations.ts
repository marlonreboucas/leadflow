import { z } from 'zod';

export const automationTriggerSchema = z.enum([
  'MESSAGE_RECEIVED',
  'LEAD_CREATED',
  'LEAD_STAGE_CHANGED',
  'CONVERSATION_ASSIGNED',
  'AI_CLASSIFIED',
  'LEAD_IDLE',
  'TASK_OVERDUE',
  'KEYWORD_DETECTED',
  'OFF_HOURS',
  'PROPOSAL_SENT',
  'CONVERSATION_FINISHED',
]);

export const automationActionTypeSchema = z.enum([
  'SEND_WHATSAPP_MESSAGE',
  'RUN_AI_AGENT',
  'SUGGEST_REPLY',
  'ASSIGN_HUMAN',
  'MOVE_STAGE',
  'CREATE_TASK',
  'APPLY_TAG',
  'SEND_N8N_WEBHOOK',
  'NOTIFY_TEAM',
  'CREATE_SUMMARY',
  'CREATE_FUTURE_EVENT',
  'PAUSE_AI',
  'TRANSFER_CONVERSATION',
]);

export const automationConditionSchema = z.object({
  field: z.string().min(1).max(120),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'lt',
    'gte',
    'lte',
    'in',
    'notIn',
    'contains',
    'regex',
  ]),
  value: z.unknown(),
});

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: automationTriggerSchema,
  isActive: z.boolean().optional(),
  runOrder: z.coerce.number().int().optional(),
  triggerConfig: z.record(z.unknown()).optional(),
});

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial();

export const upsertAutomationConditionSchema = automationConditionSchema;

export const upsertAutomationActionSchema = z.object({
  type: automationActionTypeSchema,
  position: z.coerce.number().int().min(0).default(0),
  config: z.record(z.unknown()).default({}),
});

export const testAutomationSchema = z.object({
  trigger: automationTriggerSchema,
  context: z.record(z.unknown()),
});

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
