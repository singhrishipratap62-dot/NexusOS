import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const ACCESS_TOKEN_COOKIE = 'nexus-access-token';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static assets and API routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === '/';

    // Not authenticated → redirect to login (unless already on a public path)
    if (!accessToken && !isPublicPath) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Authenticated → redirect away from auth pages
    if (accessToken && isPublicPath) {
        return NextResponse.redirect(new URL('/war-room', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
