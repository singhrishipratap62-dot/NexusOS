'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import { clientApiFetch as apiFetch } from '../../lib/api-client';
import { RunsPageClient } from './runs-client';

interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  dryRun: boolean;
  steps: any[];
  aiGenerated: boolean;
  aiReasoning: string | null;
  autoExecute: boolean;
  confidenceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

interface Run {
  id: string;
  blueprintId: string;
  status: string;
  triggeredBy: string;
  dryRun: boolean;
  stepResults: any[] | null;
  logs: string[] | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
}

interface Outcomes {
  totalRuns: number;
  activeBlueprints: number;
  totalTimeSavedMinutes: number;
  totalTimeSavedHours: number;
  estimatedAnnualSavingsHours: number;
}

async function fetchBlueprints(): Promise<Blueprint[]> {
  try {
    return await apiFetch<Blueprint[]>('/automation/blueprints');
  } catch {
    return [];
  }
}

async function fetchRuns(): Promise<Run[]> {
  try {
    return await apiFetch<Run[]>('/automation/runs');
  } catch {
    return [];
  }
}

async function fetchOutcomes(): Promise<Outcomes | null> {
  try {
    return await apiFetch<Outcomes>('/ai/outcomes');
  } catch {
    return null;
  }
}

export default async function RunsPage(): Promise<JSX.Element> {
  const [blueprints, runs, outcomes] = await Promise.all([
    fetchBlueprints(),
    fetchRuns(),
    fetchOutcomes()
  ]);

  return (
    <>
      <TopBar
        title="Automation Runs"
        subtitle={`${blueprints.length} blueprints · ${runs.length} runs`}
      />
      <div className="page-content">
        <RunsPageClient blueprints={blueprints} runs={runs} outcomes={outcomes} />
      </div>
    </>
  );
}
