/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: 'standalone' output was removed because Next.js 14 standalone mode
  // performs static prerendering even for 'use client' pages, which fails when
  // the app layout uses client-only hooks (useRouter, usePathname).
  // The app is deployed via Docker/Railway where standard output works fine.
  // If standalone is re-enabled, migrate the app shell to a proper SSR-safe pattern.
};

export default nextConfig;
