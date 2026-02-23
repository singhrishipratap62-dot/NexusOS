import { TopBar } from '../../components/ui/top-bar';
import { Key, Users, Bell, Shield } from 'lucide-react';

function SettingsSection({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-4">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

export default function SettingsPage(): JSX.Element {
  return (
    <>
      <TopBar title="Settings" subtitle="Manage your workspace configuration" />
      <div className="page-content max-w-2xl">

        <SettingsSection
          icon={Users}
          title="Team Members"
          description="Invite team members and manage roles"
        >
          <div className="text-sm text-muted-foreground mb-4">
            Team management UI is coming soon. Role-based access (Admin, Analyst, Viewer) is
            already enforced on all API endpoints.
          </div>
          <button type="button" className="btn-primary text-sm">
            Invite Member
          </button>
        </SettingsSection>

        <SettingsSection
          icon={Key}
          title="API Keys"
          description="Generate API keys for programmatic access"
        >
          <div className="text-sm text-muted-foreground mb-4">
            API key management is coming soon. Use JWT tokens from{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">POST /auth/login</code>{' '}
            for now.
          </div>
          <button type="button" className="btn-outline text-sm" disabled>
            Generate API Key
          </button>
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Configure email alerts for review queue and automation failures"
        >
          <div className="text-sm text-muted-foreground">
            Notification preferences will be configurable here. Email setup requires Resend or
            Postmark integration (Phase 6).
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Shield}
          title="Security"
          description="JWT settings, session management, and audit log"
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">JWT Secret Status</label>
              <p className="text-xs text-muted-foreground mt-1">
                Using{' '}
                {process.env.JWT_SECRET && process.env.JWT_SECRET !== 'replace-with-long-secret'
                  ? 'custom secret'
                  : 'default dev secret — change JWT_SECRET in production'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Auth Model</label>
              <p className="text-xs text-muted-foreground mt-1">
                HS256 JWT with 15-minute access tokens and 30-day rotating refresh tokens.
              </p>
            </div>
          </div>
        </SettingsSection>

      </div>
    </>
  );
}
