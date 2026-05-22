import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import {
  CreateContactDto,
  UpdateContactDto,
  ListContactsQueryDto,
} from './dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query() query: ListContactsQueryDto,
  ) {
    return this.contactsService.list(companyId, query);
  }

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.contactsService.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() body: CreateContactDto,
  ) {
    return this.contactsService.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateContactDto,
  ) {
    return this.contactsService.update(companyId, id, body);
  }
}
