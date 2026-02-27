'use client';
import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ChatPanel } from '../chat-panel';

export function ClientShell({ children }: { children: ReactNode }) {
    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                {children}
            </div>
            <ChatPanel />
        </div>
    );
}
