import { createZodDto } from 'nestjs-zod';
import {
  createMessageTemplateSchema,
  updateMessageTemplateSchema,
} from '@leadflow/shared';

export class CreateMessageTemplateDto extends createZodDto(createMessageTemplateSchema) {}
export class UpdateMessageTemplateDto extends createZodDto(updateMessageTemplateSchema) {}
