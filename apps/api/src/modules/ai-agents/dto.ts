import { createZodDto } from 'nestjs-zod';
import {
  createAgentSchema,
  updateAgentSchema,
  testAgentSchema,
  createAgentRuleSchema,
} from '@leadflow/shared';

export class CreateAgentDto extends createZodDto(createAgentSchema) {}
export class UpdateAgentDto extends createZodDto(updateAgentSchema) {}
export class TestAgentDto extends createZodDto(testAgentSchema) {}
export class CreateAgentRuleDto extends createZodDto(createAgentRuleSchema) {}
