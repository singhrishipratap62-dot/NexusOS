'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Plus } from 'lucide-react';

interface ConnectorStatus {
  id: string;
  provider: string;
  mode: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

const AVAILABLE_CONNECTORS = [
  {
    provider: 'SLACK',
    name: 'Slack',
    description: 'Sync channel messages and activity',
    icon: '💬',
    comingSoon: false
  },
  {
    provider: 'GMAIL',
    name: 'Gmail',
    description: 'Sync emails and thread patterns',
    icon: '📧',
    comingSoon: false
  },
  {
    provider: 'NOTION',
    name: 'Notion',
    description: 'Sync pages, databases, and edits',
    icon: '📝',
    comingSoon: true
  },
  {
    provider: 'LINEAR',
    name: 'Linear',
    description: 'Sync issues, comments, status changes',
    icon: '🔷',
    comingSoon: true
  },
  {
    provider: 'GITHUB',
    name: 'GitHub',
    description: 'Sync PRs, commits, and code reviews',
    icon: '🐙',
    comingSoon: true
  },
  {
    provider: 'JIRA',
    name: 'Jira',
    description: 'Sync issues and workflow transitions',
    icon: '🎫',
    comingSoon: true
  }
];

export function ConnectorsGrid({ connectors }: { connectors: ConnectorStatus[] }) {
  const [syncing, setSyncing] = useState<string | null>(null);

  const connectedMap = Object.fromEntries(connectors.map((c) => [c.provider, c]));

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    try {
      await fetch(`/api/connectors/${provider.toLowerCase()}/sync`, { method: 'POST' });
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">Data Sources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_CONNECTORS.map(({ provider, name, description, icon, comingSoon }) => {
          const connected = connectedMap[provider];
          const isSyncing = syncing === provider;

          return (
            <div key={provider} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="font-semibold text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </div>
                {comingSoon ? (
                  <span className="badge badge-secondary">Soon</span>
                ) : connected ? (
                  <span className="badge badge-success flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="badge badge-secondary flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Not connected
                  </span>
                )}
              </div>

              {connected && (
                <div className="text-xs text-muted-foreground font-mono mb-3">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Last sync:{' '}
                  {connected.lastSyncedAt
                    ? new Date(connected.lastSyncedAt).toLocaleString()
                    : 'Never'}
                </div>
              )}

              <div className="flex gap-2">
                {comingSoon ? (
                  <button type="button" className="btn-outline text-xs" disabled>
                    <Plus className="w-3 h-3" />
                    Coming Soon
                  </button>
                ) : connected ? (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => handleSync(provider)}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() =>
                      (window.location.href = `/api/connectors/${provider.toLowerCase()}/oauth/start`)
                    }
                  >
                    <Plus className="w-3 h-3" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
