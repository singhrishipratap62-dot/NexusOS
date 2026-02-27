'use server';

import { cookies } from 'next/headers';

const ACCESS_TOKEN_COOKIE = 'nexus-access-token';
const REFRESH_TOKEN_COOKIE = 'nexus-refresh-token';
const COOKIE_MAX_AGE_ACCESS = 15 * 60; // 15 minutes
const COOKIE_MAX_AGE_REFRESH = 30 * 24 * 60 * 60; // 30 days

export async function getAccessToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_ACCESS
    });

    cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_REFRESH
    });
}

export async function clearTokens(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
