import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@leadflow/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
