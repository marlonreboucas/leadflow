import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  me(@CurrentUser('companyId') companyId: string) {
    return this.companiesService.getMine(companyId);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('me')
  update(@CurrentUser('companyId') companyId: string, @Body() body: any) {
    return this.companiesService.updateMine(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('children')
  createChild(
    @CurrentUser('companyId') companyId: string,
    @Body() body: { name: string },
  ) {
    return this.companiesService.createChildAgency(companyId, body);
  }
}
