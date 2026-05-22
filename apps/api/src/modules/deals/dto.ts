import { createZodDto } from 'nestjs-zod';
import {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  closeDealSchema,
  listDealsQuerySchema,
} from '@leadflow/shared';

export class CreateDealDto extends createZodDto(createDealSchema) {}
export class UpdateDealDto extends createZodDto(updateDealSchema) {}
export class MoveDealDto extends createZodDto(moveDealSchema) {}
export class CloseDealDto extends createZodDto(closeDealSchema) {}
export class ListDealsQueryDto extends createZodDto(listDealsQuerySchema) {}
