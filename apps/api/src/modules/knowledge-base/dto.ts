import { createZodDto } from 'nestjs-zod';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  createKnowledgeItemSchema,
  updateKnowledgeItemSchema,
} from '@leadflow/shared';

export class CreateKnowledgeBaseDto extends createZodDto(createKnowledgeBaseSchema) {}
export class UpdateKnowledgeBaseDto extends createZodDto(updateKnowledgeBaseSchema) {}
export class CreateKnowledgeItemDto extends createZodDto(createKnowledgeItemSchema) {}
export class UpdateKnowledgeItemDto extends createZodDto(updateKnowledgeItemSchema) {}
