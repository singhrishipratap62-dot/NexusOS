import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { TenantRequest } from './tenant-request';

/**
 * Legacy TenantMiddleware — kept for reference but no longer applied.
 * Tenant context is now derived from JWT claims via JwtAuthGuard (APP_GUARD).
 * If re-enabled, this validates that the JWT-derived tenant context is present.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(request: TenantRequest, _response: unknown, next: () => void): void {
    if (!request.tenantContext?.tenantId) {
      throw new ForbiddenException('Tenant context missing — JWT authentication required');
    }

    next();
  }
}
