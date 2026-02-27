'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Plus, Unplug, Database } from 'lucide-react';

interface ConnectorStatus {
  id: string;
  provider: string;
  mode: string;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  eventCount: number;
  createdAt: string;
}

const AVAILABLE_CONNECTORS = [
  {
    provider: 'SLACK',
    name: 'Slack',
    description: 'Sync channel messages and activity',
    icon: '💬'
  },
  {
    provider: 'GMAIL',
    name: 'Gmail',
    description: 'Sync emails and thread patterns',
    icon: '📧'
  },
  {
    provider: 'GCAL',
    name: 'Google Calendar',
    description: 'Sync meetings and time-cost data',
    icon: '📅'
  },
  {
    provider: 'NOTION',
    name: 'Notion',
    description: 'Sync pages, databases, and edits',
    icon: '📝'
  },
  {
    provider: 'LINEAR',
    name: 'Linear',
    description: 'Sync issues, comments, status changes',
    icon: '🔷'
  },
  {
    provider: 'GITHUB',
    name: 'GitHub',
    description: 'Sync PRs, commits, and code reviews',
    icon: '🐙'
  },
  {
    provider: 'JIRA',
    name: 'Jira',
    description: 'Sync issues and workflow transitions',
    icon: '🎫'
  }
];

export function ConnectorsGrid({ connectors }: { connectors: ConnectorStatus[] }) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const connectedMap = Object.fromEntries(connectors.map((c) => [c.provider, c]));

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    try {
      await fetch(`/api/proxy?path=/connectors/${provider.toLowerCase()}/sync`, { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}? This will remove all sync history.`)) {
      return;
    }
    setDisconnecting(provider);
    try {
      await fetch(`/api/proxy?path=/connectors/${provider.toLowerCase()}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">Data Sources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_CONNECTORS.map(({ provider, name, description, icon }) => {
          const connected = connectedMap[provider];
          const isSyncing = syncing === provider;
          const isDisconnecting = disconnecting === provider;

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
                {connected ? (
                  connected.syncStatus === 'FAILED' ? (
                    <span className="badge flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      Error
                    </span>
                  ) : connected.syncStatus === 'RUNNING' || isSyncing ? (
                    <span className="badge badge-secondary flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing
                    </span>
                  ) : (
                    <span className="badge badge-success flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  )
                ) : (
                  <span className="badge badge-secondary flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Not connected
                  </span>
                )}
              </div>

              {connected && (
                <div className="text-xs text-muted-foreground font-mono mb-3 space-y-1">
                  <div>
                    <Clock className="w-3 h-3 inline mr-1" />
                    Last sync:{' '}
                    {connected.lastSyncedAt
                      ? new Date(connected.lastSyncedAt).toLocaleString()
                      : 'Never'}
                  </div>
                  <div>
                    <Database className="w-3 h-3 inline mr-1" />
                    Events synced: {connected.eventCount?.toLocaleString() ?? 0}
                  </div>
                  {connected.syncError && (
                    <div className="text-red-600 dark:text-red-400 mt-2 bg-red-100 dark:bg-red-900/20 px-2 py-1.5 rounded text-xs">
                      <strong className="font-semibold block mb-0.5">Sync Error:</strong>
                      {connected.syncError}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {connected ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => handleSync(provider)}
                      disabled={isSyncing || isDisconnecting || connected.syncStatus === 'RUNNING'}
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing || connected.syncStatus === 'RUNNING' ? 'animate-spin' : ''}`} />
                      {isSyncing || connected.syncStatus === 'RUNNING' ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                      type="button"
                      className="btn-destructive text-xs"
                      onClick={() => handleDisconnect(provider)}
                      disabled={isSyncing || isDisconnecting}
                    >
                      <Unplug className="w-3 h-3" />
                      {isDisconnecting ? 'Removing...' : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/proxy?path=/connectors/${provider.toLowerCase()}/oauth/start`);
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else {
                          console.error('Missing URL in OAuth response:', data);
                        }
                      } catch (err) {
                        console.error('Failed to start OAuth flow:', err);
                      }
                    }}
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
