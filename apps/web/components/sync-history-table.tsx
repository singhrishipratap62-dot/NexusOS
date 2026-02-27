'use client';

import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface SyncJob {
    id: string;
    status: string;
    provider: string;
    createdAt: string;
    error: string | null;
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'SUCCEEDED') {
        return (
            <span className="badge badge-success flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Succeeded
            </span>
        );
    }
    if (status === 'FAILED') {
        return (
            <span className="badge badge-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Failed
            </span>
        );
    }
    if (status === 'RUNNING') {
        return (
            <span className="badge badge-warning flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
            </span>
        );
    }
    if (status === 'QUEUED') {
        return (
            <span className="badge badge-secondary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Queued
            </span>
        );
    }
    return (
        <span className="badge badge-secondary flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {status}
        </span>
    );
}

export function SyncHistoryTable({ jobs }: { jobs: SyncJob[] }) {
    if (jobs.length === 0) {
        return (
            <div className="card p-8 text-center">
                <p className="text-muted-foreground text-sm">No sync jobs yet. Connect a data source and trigger a sync.</p>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Provider</th>
                            <th>Status</th>
                            <th>Started</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((job) => (
                            <tr key={job.id}>
                                <td>
                                    <span className="font-medium text-sm">{job.provider}</span>
                                </td>
                                <td>
                                    <StatusBadge status={job.status} />
                                </td>
                                <td className="font-mono text-sm text-muted-foreground">
                                    {new Date(job.createdAt).toLocaleString()}
                                </td>
                                <td>
                                    {job.error ? (
                                        <span className="text-xs text-destructive truncate max-w-[200px] block">
                                            {job.error}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
