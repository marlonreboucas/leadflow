import { z } from 'zod';

export const agentTypeSchema = z.enum([
  'SDR',
  'SALES',
  'SUPPORT',
  'SCHEDULING',
  'RECOVERY',
  'FINANCE',
  'SUPERVISOR',
  'CUSTOM',
]);

export const agentModeSchema = z.enum([
  'FULL_AUTO',
  'SUGGEST',
  'OFF_HOURS_ONLY',
  'NEW_LEADS_ONLY',
  'STAGE_ONLY',
  'HUMAN_APPROVAL',
]);

export const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  type: agentTypeSchema.default('SDR'),
  model: z.string().max(80).default('gpt-4o-mini'),
  systemPrompt: z.string().min(10).max(12000),
  voiceTone: z.string().max(500).optional(),
  objective: z.string().max(1000).optional(),
  mode: agentModeSchema.default('SUGGEST'),
  temperature: z.coerce.number().min(0).max(2).default(0.4),
  maxTokens: z.coerce.number().int().min(100).max(8000).default(800),
  isActive: z.boolean().default(true),
  knowledgeBaseIds: z.array(z.string()).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema.partial();
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const testAgentSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationContext: z.string().max(8000).optional(),
});
export type TestAgentInput = z.infer<typeof testAgentSchema>;

export const createAgentRuleSchema = z.object({
  position: z.coerce.number().int().min(0).default(0),
  type: z.string().min(1).max(60),
  condition: z.record(z.unknown()),
  action: z.record(z.unknown()),
});
export type CreateAgentRuleInput = z.infer<typeof createAgentRuleSchema>;
