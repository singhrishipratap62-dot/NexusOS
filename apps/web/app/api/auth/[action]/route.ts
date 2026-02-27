import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const ACCESS_TOKEN_COOKIE = 'nexus-access-token';
const REFRESH_TOKEN_COOKIE = 'nexus-refresh-token';
const COOKIE_MAX_AGE_ACCESS = 15 * 60;
const COOKIE_MAX_AGE_REFRESH = 30 * 24 * 60 * 60;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ action: string }> }
) {
    const { action } = await params;
    const body = await request.json();

    if (action === 'login') {
        return handleLogin(body);
    }

    if (action === 'register') {
        return handleRegister(body);
    }

    if (action === 'demo-login') {
        return handleDemoLogin(body);
    }

    if (action === 'logout') {
        return handleLogout(request);
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 404 });
}

async function handleLogin(body: { email: string; password: string }) {
    const apiResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        return NextResponse.json(
            { message: data.message ?? 'Invalid credentials' },
            { status: apiResponse.status }
        );
    }

    const response = NextResponse.json({
        user: data.user,
        tenantId: data.tenantId,
        role: data.role
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, data.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_ACCESS
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, data.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_REFRESH
    });

    return response;
}

async function handleRegister(body: { email: string; password: string; name?: string }) {
    const apiResponse = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        return NextResponse.json(
            { message: data.message ?? 'Registration failed' },
            { status: apiResponse.status }
        );
    }

    const response = NextResponse.json({
        user: data.user,
        tenant: data.tenant
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, data.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_ACCESS
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, data.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_REFRESH
    });

    return response;
}

async function handleLogout(request: NextRequest) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    // Best-effort logout on the API side
    if (refreshToken && accessToken) {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({ refreshToken })
            });
        } catch {
            // Ignore — we clear cookies regardless
        }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
}

async function handleDemoLogin(body: { token: string }) {
    if (!body.token) {
        return NextResponse.json({ message: 'Token required' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(ACCESS_TOKEN_COOKIE, body.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_ACCESS
    });

    return response;
}
