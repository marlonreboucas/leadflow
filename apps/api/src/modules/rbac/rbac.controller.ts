import { Controller, Get } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('roles')
  roles() {
    return this.rbacService.listRoles();
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('permissions')
  perms() {
    return this.rbacService.listPermissions();
  }
}
