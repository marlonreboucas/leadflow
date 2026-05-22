import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveDealDto,
  CloseDealDto,
  ListDealsQueryDto,
} from './dto';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query() query: ListDealsQueryDto,
  ) {
    return this.dealsService.list(companyId, query);
  }

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get(':id/timeline')
  timeline(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.dealsService.getTimeline(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.dealsService.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() body: CreateDealDto,
  ) {
    return this.dealsService.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateDealDto,
  ) {
    return this.dealsService.update(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Post(':id/move')
  move(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: MoveDealDto,
  ) {
    return this.dealsService.move(companyId, id, body.stageId, body.lossReason);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Post(':id/close')
  close(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: CloseDealDto,
  ) {
    return this.dealsService.close(companyId, id, body.status, body.lossReason, body.winReason);
  }

  @RequirePermissions(PERMISSIONS.LEADS_DELETE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.dealsService.remove(companyId, id);
  }
}
