'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { TopBar } from '../../components/ui/top-bar';
import {
  Users,
  Key,
  Bell,
  Shield,
  Save,
  Loader2,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('team');
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState('My Organization');
  const [apiKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Production', prefix: 'nxs_prod_', createdAt: '2025-01-15' },
    { id: '2', name: 'Development', prefix: 'nxs_dev_', createdAt: '2025-02-01' }
  ]);
  const [notifications, setNotifications] = useState({
    syncFailures: true,
    reviewAlerts: true,
    automationFailures: true,
    weeklySummary: false
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  const tabs = [
    { id: 'team', label: 'Team', icon: Users },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  return (
    <>
      <TopBar title="Settings" subtitle="Manage your organization" />
      <div className="page-content">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--color-muted)' }}>
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Team */}
        {activeTab === 'team' && (
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-sm">Organization</h3>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Organization Name</label>
              <input
                type="text"
                className="auth-input w-full max-w-sm"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <h3 className="font-semibold text-sm pt-4">Team Members</h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium text-sm">You</td>
                    <td className="text-sm text-muted-foreground">admin@company.com</td>
                    <td><span className="badge badge-success">Admin</span></td>
                    <td><span className="badge badge-success">Active</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button type="button" className="btn-secondary text-xs mt-2">
              <Plus className="w-3 h-3 mr-1" />
              Invite Member
            </button>

            <div className="flex justify-end pt-4">
              <button type="button" className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* API Keys */}
        {activeTab === 'api-keys' && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">API Keys</h3>
              <button type="button" className="btn-primary text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Generate Key
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="font-medium text-sm">{key.name}</td>
                    <td className="font-mono text-xs text-muted-foreground">{key.prefix}••••••••</td>
                    <td className="text-xs text-muted-foreground">{key.createdAt}</td>
                    <td className="flex gap-1">
                      <button type="button" className="btn-secondary text-xs p-1"><Copy className="w-3 h-3" /></button>
                      <button type="button" className="btn-destructive text-xs p-1"><Trash2 className="w-3 h-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-sm">Notification Preferences</h3>
            {[
              { key: 'syncFailures', label: 'Connector sync failures', desc: 'Alert when a data source sync fails' },
              { key: 'reviewAlerts', label: 'Review queue alerts', desc: 'Notify when items need review' },
              { key: 'automationFailures', label: 'Automation run failures', desc: 'Alert when a blueprint run fails' },
              { key: 'weeklySummary', label: 'Weekly summary', desc: 'Email digest of audit findings' }
            ].map((pref) => (
              <div key={pref.key} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">{pref.label}</div>
                  <div className="text-xs text-muted-foreground">{pref.desc}</div>
                </div>
                <button
                  type="button"
                  className={`w-10 h-5 rounded-full transition-colors relative ${(notifications as any)[pref.key] ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  onClick={() => setNotifications({ ...notifications, [pref.key]: !(notifications as any)[pref.key] })}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(notifications as any)[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                  />
                </button>
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <button type="button" className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Security */}
        {activeTab === 'security' && (
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-sm">Security Settings</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">Two-Factor Authentication</div>
                  <div className="text-xs text-muted-foreground">Add an extra layer of security to your account</div>
                </div>
                <button type="button" className="btn-secondary text-xs">Enable 2FA</button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">Session Management</div>
                  <div className="text-xs text-muted-foreground">View and revoke active sessions</div>
                </div>
                <span className="badge badge-secondary">1 active session</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">OAuth Token Encryption</div>
                  <div className="text-xs text-muted-foreground">All connector tokens encrypted with AES-256-GCM</div>
                </div>
                <span className="badge badge-success flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">Rate Limiting</div>
                  <div className="text-xs text-muted-foreground">API rate limiting is active per tenant</div>
                </div>
                <span className="badge badge-success flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Active
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="font-medium text-sm text-destructive mb-2">Danger Zone</h4>
              <button type="button" className="btn-destructive text-xs">Delete Organization</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
