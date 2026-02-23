export interface TenantContext {
  tenantId: string;
  actorId: string;
  role?: string;
}

export interface TenantRequest {
  header: (name: string) => string | undefined;
  method?: string;
  route?: { path?: string };
  path?: string;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  tenantContext?: TenantContext;
  [key: string]: unknown;
}

export function requireTenantContext(request: TenantRequest): TenantContext {
  if (!request.tenantContext) {
    throw new Error('Tenant context is missing from request');
  }
  return request.tenantContext;
}
