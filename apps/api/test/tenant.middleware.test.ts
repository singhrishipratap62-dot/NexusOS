import { describe, expect, it, vi } from 'vitest';
import { TenantMiddleware } from '../src/common/tenant.middleware';

describe('TenantMiddleware', () => {
  it('accepts request with valid JWT-derived tenant context', () => {
    const middleware = new TenantMiddleware();
    const request: any = {
      header: () => undefined,
      tenantContext: {
        tenantId: 'tenant_abc',
        actorId: 'user_1',
        role: 'ADMIN'
      }
    };

    const next = vi.fn();
    middleware.use(request, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects request without tenant context', () => {
    const middleware = new TenantMiddleware();
    const request: any = {
      header: () => undefined
    };

    expect(() => middleware.use(request, {} as never, vi.fn())).toThrowError(
      'Tenant context missing'
    );
  });

  it('rejects request with empty tenantId', () => {
    const middleware = new TenantMiddleware();
    const request: any = {
      header: () => undefined,
      tenantContext: { tenantId: '', actorId: 'user_1' }
    };

    expect(() => middleware.use(request, {} as never, vi.fn())).toThrowError(
      'Tenant context missing'
    );
  });
});
