import { z } from 'zod';

export const conversationStatusSchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'WITH_AI',
  'WAITING_HUMAN',
  'WAITING_CUSTOMER',
  'FINISHED',
  'LOST',
  'SPAM',
]);

export const conversationInboxFilterSchema = z.enum([
  'all',
  'unread',
  'mine',
  'no_deal',
  'hot',
]);

export const listConversationsQuerySchema = z.object({
  status: conversationStatusSchema.optional(),
  assignedUserId: z.string().optional(),
  instanceId: z.string().optional(),
  filter: conversationInboxFilterSchema.optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
