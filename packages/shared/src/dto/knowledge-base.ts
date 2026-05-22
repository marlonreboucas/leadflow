import { z } from 'zod';

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});
export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;

export const updateKnowledgeBaseSchema = createKnowledgeBaseSchema.partial();

export const createKnowledgeItemSchema = z.object({
  kind: z.enum(['FAQ', 'PRODUCT', 'PRICE', 'POLICY', 'OBJECTION', 'OTHER']).default('FAQ'),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateKnowledgeItemInput = z.infer<typeof createKnowledgeItemSchema>;

export const updateKnowledgeItemSchema = createKnowledgeItemSchema.partial();
