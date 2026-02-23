import { describe, expect, it, vi } from 'vitest';
import { AuthMiddleware } from '../src/common/auth.middleware';
import { TenantMiddleware } from '../src/common/tenant.middleware';
import { TenantRequest } from '../src/common/tenant-request';

function buildRequest(headers: Record<string, string | undefined>): TenantRequest {
  return {
    header: (name: string) => headers[name.toLowerCase()]
  };
}

describe('Auth + Tenant guardrails', () => {
  it('accepts valid token and matching tenant', () => {
    process.env.AUTH_STATIC_TOKEN = 'test-token';
    process.env.SINGLE_TENANT_ID = 'tenant_day1';
    const auth = new AuthMiddleware();
    const tenant = new TenantMiddleware();

    const request = buildRequest({
      authorization: 'Bearer test-token',
      'x-tenant-id': 'tenant_day1',
      'x-actor-id': 'analyst-01'
    });

    auth.use(request, {}, vi.fn());
    tenant.use(request, {}, vi.fn());

    expect(request.tenantContext?.tenantId).toBe('tenant_day1');
    expect(request.tenantContext?.actorId).toBe('analyst-01');
  });

  it('rejects requests without auth bearer token', () => {
    process.env.AUTH_STATIC_TOKEN = 'test-token';
    const auth = new AuthMiddleware();

    const request = buildRequest({
      'x-tenant-id': 'tenant_day1',
      'x-actor-id': 'analyst-01'
    });

    expect(() => auth.use(request, {}, vi.fn())).toThrowError();
  });

  it('rejects cross-tenant access even with valid auth', () => {
    process.env.AUTH_STATIC_TOKEN = 'test-token';
    process.env.SINGLE_TENANT_ID = 'tenant_day1';
    const auth = new AuthMiddleware();
    const tenant = new TenantMiddleware();

    const request = buildRequest({
      authorization: 'Bearer test-token',
      'x-tenant-id': 'tenant_other',
      'x-actor-id': 'analyst-01'
    });

    auth.use(request, {}, vi.fn());

    expect(() => tenant.use(request, {}, vi.fn())).toThrowError();
  });
});
