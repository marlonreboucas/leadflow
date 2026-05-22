import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  SetAutomationConditionsDto,
  SetAutomationActionsDto,
  TestAutomationDto,
} from './dto';
import type { AutomationContext } from '@leadflow/automation';

@Controller('automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.automations.list(companyId);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.automations.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() body: CreateAutomationRuleDto) {
    return this.automations.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateAutomationRuleDto,
  ) {
    return this.automations.update(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.automations.remove(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post(':id/conditions')
  setConditions(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: SetAutomationConditionsDto,
  ) {
    return this.automations.setConditions(companyId, id, body.conditions);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post(':id/actions')
  setActions(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: SetAutomationActionsDto,
  ) {
    return this.automations.setActions(companyId, id, body.actions);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post(':id/test')
  test(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: TestAutomationDto,
  ) {
    return this.automations.test(companyId, body.trigger, body.context as AutomationContext);
  }

  @RequirePermissions(PERMISSIONS.AUTOMATIONS_MANAGE)
  @Post(':id/run')
  run(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: TestAutomationDto,
  ) {
    return this.automations.runNow(companyId, id, body.context as AutomationContext);
  }
}
