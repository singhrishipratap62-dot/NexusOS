import { TopBar } from '../../components/ui/top-bar';
import { Play } from 'lucide-react';

export default function RunsPage(): JSX.Element {
  return (
    <>
      <TopBar
        title="Automation Runs"
        subtitle="Monitor active and historical automation executions"
      />
      <div className="page-content">
        <div className="card p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Agent Runtime Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Automation execution is planned for Phase 4. Once blueprints are configured,
            runs will appear here with real-time status and step-by-step logs.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            <span className="badge badge-secondary">Blueprint Editor</span>
            <span className="badge badge-secondary">Trigger System</span>
            <span className="badge badge-secondary">Live Log Streaming</span>
            <span className="badge badge-secondary">Human-in-the-Loop</span>
          </div>
        </div>
      </div>
    </>
  );
}
