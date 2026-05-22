import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(8000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
