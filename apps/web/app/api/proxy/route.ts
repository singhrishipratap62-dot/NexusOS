import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ACCESS_TOKEN_COOKIE = 'nexus-access-token';

/**
 * API proxy for client-side components to call the backend API.
 * Reads the JWT from cookies and forwards requests with proper auth headers.
 */
export async function GET(request: NextRequest) {
    return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
    return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
    return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
    return proxyRequest(request, 'DELETE');
}

async function proxyRequest(request: NextRequest, method: string) {
    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
        return NextResponse.json({ message: 'Missing path parameter' }, { status: 400 });
    }

    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
        try {
            body = await request.text();
        } catch {
            // No body
        }
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const apiResponse = await fetch(url, {
            method,
            headers,
            body: body || undefined,
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (apiResponse.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        let data: unknown;
        try {
            data = await apiResponse.json();
        } catch {
            return NextResponse.json(
                { message: 'Invalid response from API server' },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: apiResponse.status });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            return NextResponse.json(
                { message: 'API request timed out' },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { message: 'Failed to reach API server' },
            { status: 502 }
        );
    }
}
