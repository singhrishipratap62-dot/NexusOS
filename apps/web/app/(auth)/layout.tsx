import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="auth-layout">
            <div className="auth-container">
                <div className="auth-logo">
                    <Zap className="w-8 h-8 text-primary" />
                    <span className="text-2xl font-bold text-foreground tracking-tight">NexusOS</span>
                </div>
                {children}
            </div>
        </div>
    );
}
