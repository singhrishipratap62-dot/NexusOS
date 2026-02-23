'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Blocks,
  ClipboardCheck,
  Play,
  Settings,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { href: '/war-room', label: 'War Room', icon: BarChart3 },
  { href: '/review', label: 'Review Queue', icon: ClipboardCheck },
  { href: '/connectors', label: 'Connectors', icon: Blocks },
  { href: '/runs', label: 'Automation Runs', icon: Play },
  { href: '/settings', label: 'Settings', icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

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

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground font-mono">NexusOS v0.2.0</p>
      </div>
    </aside>
  );
}
