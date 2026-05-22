import { z } from 'zod';

export const createMessageTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  niche: z.string().max(80).optional(),
  body: z.string().min(1).max(4000),
});
export type CreateMessageTemplateInput = z.infer<typeof createMessageTemplateSchema>;

export const updateMessageTemplateSchema = createMessageTemplateSchema.partial();
export type UpdateMessageTemplateInput = z.infer<typeof updateMessageTemplateSchema>;
