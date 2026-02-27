'use client';

import { useRouter } from 'next/navigation';
import { Bell, LogOut, User } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="top-bar">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost p-2 rounded-full" aria-label="Notifications">
          <Bell className="w-5 h-5 text-muted-foreground" />
        </button>
        <button type="button" className="btn-ghost p-2 rounded-full" aria-label="Profile">
          <User className="w-5 h-5 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="btn-ghost p-2 rounded-full"
          aria-label="Sign out"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
