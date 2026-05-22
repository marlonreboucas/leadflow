import { z } from 'zod';

export const createContactSchema = z.object({
  phone: z.string().min(5).max(32),
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  origin: z.string().max(60).optional(),
  segment: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  origin: z.string().max(60).nullable().optional(),
  segment: z.string().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  blocked: z.boolean().optional(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const listContactsQuerySchema = z.object({
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
