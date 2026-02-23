import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { TenantRequest } from '../common/tenant-request';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const method = request.method ?? 'UNKNOWN';
    const path = request.path ?? '/unknown';
    const action = `${method}:${request.route?.path ?? path}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const tenantContext = request.tenantContext;
          if (!tenantContext) {
            return;
          }

          void this.auditService.record({
            tenantId: tenantContext.tenantId,
            actorId: tenantContext.actorId,
            path,
            method,
            action,
            metadata: {
              query: request.query,
              params: request.params,
              statusCode: context.switchToHttp().getResponse().statusCode
            }
          });
        },
        error: (error) => {
          const tenantContext = request.tenantContext;
          if (!tenantContext) {
            return;
          }

          void this.auditService.record({
            tenantId: tenantContext.tenantId,
            actorId: tenantContext.actorId,
            path,
            method,
            action: `${action}:error`,
            metadata: {
              query: request.query,
              params: request.params,
              statusCode: context.switchToHttp().getResponse().statusCode,
              error: (error as Error).message
            }
          });
        }
      })
    );
  }
}
