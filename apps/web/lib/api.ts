import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ACCESS_TOKEN_COOKIE = 'nexus-access-token';
const REFRESH_TOKEN_COOKIE = 'nexus-refresh-token';

/**
 * Server-side API client that reads JWT from cookies and injects it into requests.
 * All pages should use this instead of raw fetch() with static tokens.
 */
export async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {})
    };

    if (accessToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store'
    });

    if (!response.ok) {
        // Attempt token refresh on 401
        if (response.status === 401 && accessToken) {
            const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
            if (refreshToken) {
                const refreshed = await tryRefreshToken(refreshToken);
                if (refreshed) {
                    // Retry with new token
                    (headers as Record<string, string>)['Authorization'] = `Bearer ${refreshed}`;
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers,
                        cache: 'no-store'
                    });
                    if (retryResponse.ok) {
                        return retryResponse.json() as Promise<T>;
                    }
                }
            }
        }

        throw new ApiError(response.status, `API error: ${response.status} ${response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
}

async function tryRefreshToken(refreshToken: string): Promise<string | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) return null;

        const data = await response.json();
        // Note: we can't set cookies from this util since it's not a Server Action.
        // The middleware or the page must handle token refresh cookie setting.
        return data.tokens?.accessToken ?? null;
    } catch {
        return null;
    }
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Client-side fetch wrapper for use in client components.
 * Hits Next.js API route proxy which forwards to the backend.
 */
export async function clientApiFetch<T = unknown>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `/api/proxy?path=${encodeURIComponent(path)}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> ?? {})
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Session expired — redirect to login
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        throw new Error(`API error: ${response.status}`);
    }

    if (response.status === 204) {
        return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
}
