import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { CreateKnowledgeBaseDto, CreateKnowledgeItemDto } from './dto';

@Controller('knowledge-bases')
export class KnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @RequirePermissions(PERMISSIONS.AGENTS_VIEW)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.kb.listBases(companyId);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() body: CreateKnowledgeBaseDto) {
    return this.kb.createBase(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.kb.getBase(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.kb.deleteBase(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Post(':id/items')
  addItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') kbId: string,
    @Body() body: CreateKnowledgeItemDto,
  ) {
    return this.kb.createItem(companyId, kbId, body);
  }

  @RequirePermissions(PERMISSIONS.AGENTS_MANAGE)
  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') kbId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.kb.deleteItem(companyId, kbId, itemId);
  }
}
