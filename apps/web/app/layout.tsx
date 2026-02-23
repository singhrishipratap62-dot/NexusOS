import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from '../components/ui/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexusOS',
  description: 'AI-powered workflow automation platform'
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="main-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
