import { describe, expect, it, vi } from 'vitest';
import { TenantMiddleware } from '../src/common/tenant.middleware';

function buildRequest(headers: Record<string, string | undefined>): any {
  return {
    header: (name: string) => headers[name.toLowerCase()]
  };
}

describe('TenantMiddleware', () => {
  it('accepts matching single tenant and attaches context', () => {
    process.env.SINGLE_TENANT_ID = 'tenant_day1';
    const middleware = new TenantMiddleware();
    const request = buildRequest({
      'x-tenant-id': 'tenant_day1',
      'x-actor-id': 'analyst-1'
    });

    const next = vi.fn();
    middleware.use(request, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.tenantContext).toEqual({
      tenantId: 'tenant_day1',
      actorId: 'analyst-1'
    });
  });

  it('rejects non-matching tenant id', () => {
    process.env.SINGLE_TENANT_ID = 'tenant_day1';
    const middleware = new TenantMiddleware();
    const request = buildRequest({
      'x-tenant-id': 'tenant_other'
    });

    expect(() => middleware.use(request, {} as never, vi.fn())).toThrowError();
  });
});
