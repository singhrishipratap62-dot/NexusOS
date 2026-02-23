import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { TenantRequest } from './tenant-request';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly staticToken = process.env.AUTH_STATIC_TOKEN ?? 'day1-mvp-token';

  use(request: TenantRequest, _response: unknown, next: () => void): void {
    const authorization = request.header('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token || token !== this.staticToken) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const actorId = request.header('x-actor-id') ?? 'authenticated-user';
    request.tenantContext = {
      tenantId: request.tenantContext?.tenantId ?? '',
      actorId
    };

    next();
  }
}
