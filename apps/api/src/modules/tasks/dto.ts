import { createZodDto } from 'nestjs-zod';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
} from '@leadflow/shared';

export class CreateTaskDto extends createZodDto(createTaskSchema) {}
export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}
export class ListTasksQueryDto extends createZodDto(listTasksQuerySchema) {}
