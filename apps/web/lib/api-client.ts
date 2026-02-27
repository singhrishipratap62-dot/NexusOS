/**
 * Client-side API helpers — safe to import in 'use client' components.
 * Does NOT use next/headers or any server-only APIs.
 */

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
 * Client-side fetch wrapper. Routes requests through the Next.js API proxy
 * to ensure HttpOnly cookies are attached automatically.
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
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            throw new ApiError(401, 'Session expired');
        }
        throw new ApiError(response.status, `API error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
        return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
}
