import { z } from 'zod';

export const taskStatusSchema = z.enum(['PENDING', 'DOING', 'DONE', 'CANCELED']);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(2000).optional(),
  dueAt: z.coerce.date().optional(),
  assigneeUserId: z.string().optional(),
  dealId: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: taskStatusSchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  assigneeUserId: z.string().optional(),
  dealId: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
