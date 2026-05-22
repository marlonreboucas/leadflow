import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.pipelinesService.list(companyId);
  }

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get(':id/forecast')
  async forecast(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    const data = await this.pipelinesService.getForecast(companyId, id);
    if (!data) throw new NotFoundException('Pipeline não encontrado');
    return data;
  }
}
