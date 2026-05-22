import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AiAgentsService } from './ai-agents.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { CreateAgentDto, UpdateAgentDto, TestAgentDto, CreateAgentRuleDto } from './dto';

@Controller('ai-agents')
export class AiAgentsController {
  constructor(private readonly agents: AiAgentsService) {}

  @RequirePermissions(PERMISSIONS.AGENTS_VIEW)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.agents.list(companyId);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.agents.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() body: CreateAgentDto) {
    return this.agents.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agents.update(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.agents.remove(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Post(':id/rules')
  addRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: CreateAgentRuleDto,
  ) {
    return this.agents.addRule(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_VIEW)
  @Post(':id/test')
  test(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: TestAgentDto,
  ) {
    return this.agents.test(companyId, id, body.message, body.conversationContext);
  }
}
