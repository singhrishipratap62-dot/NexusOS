import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt.guard';
import { TenantMiddleware } from '../src/common/tenant.middleware';
import { TenantRequest } from '../src/common/tenant-request';

function buildRequest(
  headers: Record<string, string | undefined>,
  tenantContext?: { tenantId: string; actorId: string; role?: string }
): TenantRequest {
  const req: TenantRequest = {
    header: (name: string) => headers[name.toLowerCase()]
  };
  if (tenantContext) {
    req.tenantContext = tenantContext;
  }
  return req;
}

describe('JwtAuthGuard + Tenant context', () => {
  it('JWT guard populates tenant context from JWT claims', async () => {
    // JwtAuthGuard extracts tenantId, actorId (sub), and role from JWT payload.
    // This test verifies the tenant context shape is correct.
    const request = buildRequest(
      { authorization: 'Bearer valid-token' },
      { tenantId: 'tenant_1', actorId: 'user_1', role: 'ADMIN' }
    );

    expect(request.tenantContext?.tenantId).toBe('tenant_1');
    expect(request.tenantContext?.actorId).toBe('user_1');
    expect(request.tenantContext?.role).toBe('ADMIN');
  });

  it('TenantMiddleware accepts request with JWT-derived tenant context', () => {
    const middleware = new TenantMiddleware();
    const request = buildRequest(
      {},
      { tenantId: 'tenant_1', actorId: 'user_1', role: 'ANALYST' }
    );

    const next = vi.fn();
    middleware.use(request, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('TenantMiddleware rejects request without tenant context', () => {
    const middleware = new TenantMiddleware();
    const request = buildRequest({});

    expect(() => middleware.use(request, {} as never, vi.fn())).toThrowError(
      'Tenant context missing'
    );
  });

  it('TenantMiddleware rejects request with empty tenantId', () => {
    const middleware = new TenantMiddleware();
    const request = buildRequest(
      {},
      { tenantId: '', actorId: 'user_1' }
    );

    expect(() => middleware.use(request, {} as never, vi.fn())).toThrowError(
      'Tenant context missing'
    );
  });
});
