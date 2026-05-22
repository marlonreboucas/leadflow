import { z } from 'zod';

export const dealStatusSchema = z.enum(['OPEN', 'WON', 'LOST']);
export const dealTemperatureSchema = z.enum(['COLD', 'WARM', 'HOT']);

export const createDealSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  newContact: z
    .object({
      phone: z.string().min(5).max(32),
      name: z.string().max(120).optional(),
    })
    .optional(),
  title: z.string().min(1).max(180),
  valueCents: z.coerce.number().int().min(0).default(0),
  temperature: dealTemperatureSchema.default('COLD'),
  ownerUserId: z.string().optional(),
  nextActionAt: z.coerce.date().optional(),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  valueCents: z.coerce.number().int().min(0).optional(),
  temperature: dealTemperatureSchema.optional(),
  ownerUserId: z.string().nullable().optional(),
  nextActionAt: z.coerce.date().nullable().optional(),
});
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const moveDealSchema = z.object({
  stageId: z.string().min(1),
  lossReason: z.string().max(500).optional(),
});

export const closeDealSchema = z.object({
  status: z.enum(['WON', 'LOST']),
  lossReason: z.string().max(500).optional(),
  winReason: z.string().max(500).optional(),
});

export const listDealsQuerySchema = z.object({
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  ownerUserId: z.string().optional(),
  temperature: dealTemperatureSchema.optional(),
  status: dealStatusSchema.optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;
