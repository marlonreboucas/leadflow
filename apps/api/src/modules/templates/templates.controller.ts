import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { CreateMessageTemplateDto, UpdateMessageTemplateDto } from './dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.templates.list(companyId);
  }

  @RequirePermissions(PERMISSIONS.CONVERSATIONS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.templates.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() body: CreateMessageTemplateDto) {
    return this.templates.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateMessageTemplateDto,
  ) {
    return this.templates.update(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.templates.remove(companyId, id);
  }
}
