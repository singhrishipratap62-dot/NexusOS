'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Blocks,
  Bot,
  ClipboardCheck,
  LogOut,
  Play,
  Settings,
  User,
  Zap,
  Network
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { href: '/war-room', label: 'War Room', icon: BarChart3 },
  { href: '/review', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/connectors', label: 'Connectors', icon: Blocks },
  { href: '/runs', label: 'Automation Runs', icon: Play },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/chains', label: 'Agent Chains', icon: Network },
  { href: '/settings', label: 'Settings', icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors — we redirect regardless
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Zap className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg text-foreground tracking-tight">NexusOS</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'sidebar-nav-item',
              pathname?.startsWith(href) && 'active'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="sidebar-user-info">
            <p className="text-xs font-medium text-foreground truncate">NexusOS v0.2.0</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost p-1.5 rounded-md ml-auto"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
