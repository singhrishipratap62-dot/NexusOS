import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { TenantRequest } from './tenant-request';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly singleTenantId = process.env.SINGLE_TENANT_ID ?? 'tenant_day1';

  use(request: TenantRequest, _response: unknown, next: () => void): void {
    const tenantIdHeader = request.header('x-tenant-id');

    if (!tenantIdHeader || tenantIdHeader !== this.singleTenantId) {
      throw new ForbiddenException(`Only tenant ${this.singleTenantId} is allowed`);
    }

    const actorId = request.tenantContext?.actorId ?? request.header('x-actor-id') ?? 'system-user';

    request.tenantContext = {
      tenantId: tenantIdHeader,
      actorId
    };

    next();
  }
}
