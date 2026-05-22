import { createZodDto } from 'nestjs-zod';
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  upsertAutomationConditionSchema,
  upsertAutomationActionSchema,
  testAutomationSchema,
} from '@leadflow/shared';
import { z } from 'zod';

export class CreateAutomationRuleDto extends createZodDto(createAutomationRuleSchema) {}
export class UpdateAutomationRuleDto extends createZodDto(updateAutomationRuleSchema) {}

const setConditionsSchema = z.object({
  conditions: z.array(upsertAutomationConditionSchema),
});
export class SetAutomationConditionsDto extends createZodDto(setConditionsSchema) {}

const setActionsSchema = z.object({
  actions: z.array(upsertAutomationActionSchema),
});
export class SetAutomationActionsDto extends createZodDto(setActionsSchema) {}

export class TestAutomationDto extends createZodDto(testAutomationSchema) {}
