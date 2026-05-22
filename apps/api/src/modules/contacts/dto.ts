import { createZodDto } from 'nestjs-zod';
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
} from '@leadflow/shared';

export class CreateContactDto extends createZodDto(createContactSchema) {}
export class UpdateContactDto extends createZodDto(updateContactSchema) {}
export class ListContactsQueryDto extends createZodDto(listContactsQuerySchema) {}
