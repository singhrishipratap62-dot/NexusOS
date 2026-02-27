'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
    error,
    reset
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="page-content flex items-center justify-center min-h-[60vh]">
            <div className="card p-12 text-center max-w-md">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                </div>
                <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-4">
                    {error.message || 'An unexpected error occurred while loading this page.'}
                </p>
                <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={reset}
                >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                </button>
            </div>
        </div>
    );
}
