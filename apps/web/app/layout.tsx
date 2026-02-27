import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import './globals.css';

const ClientShell = dynamic(
  () => import('../components/ui/client-shell').then(m => m.ClientShell),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'NexusOS',
  description: 'AI-powered workflow automation platform'
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head />
      <body>
        <Suspense fallback={<div style={{ background: '#0a0a0a', minHeight: '100vh' }} />}>
          <ClientShell>{children}</ClientShell>
        </Suspense>
      </body>
    </html>
  );
}
