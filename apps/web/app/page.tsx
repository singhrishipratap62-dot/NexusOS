'use client';
export const dynamic = 'force-dynamic';
import nextDynamic from 'next/dynamic';

// LandingClient uses useRouter/useState — load client-side only
const LandingClient = nextDynamic(
  () => import('./landing-client').then(m => m.LandingClient),
  { ssr: false }
);

export default function RootPage() {
  return <LandingClient />;
}
