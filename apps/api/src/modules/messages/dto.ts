import { createZodDto } from 'nestjs-zod';
import { sendMessageSchema, listMessagesQuerySchema } from '@leadflow/shared';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class ListMessagesQueryDto extends createZodDto(listMessagesQuerySchema) {}
