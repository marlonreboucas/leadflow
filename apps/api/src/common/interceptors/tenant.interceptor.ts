import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CompanyContext } from '../tenant/company-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (req?.user?.companyId) {
      return CompanyContext.run({ companyId: req.user.companyId, userId: req.user.userId }, () =>
        next.handle(),
      );
    }
    return next.handle();
  }
}
