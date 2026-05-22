import { createZodDto } from 'nestjs-zod';
import { listConversationsQuerySchema } from '@leadflow/shared';

export class ListConversationsQueryDto extends createZodDto(listConversationsQuerySchema) {}
