import { NormalizedEvent, WorkflowExtractionResult } from '@nexus/contracts';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SEQUENCE = 1;
const MAX_SEQUENCE = 50;
const MIN_RECURRING_RUNS = 2;

interface ParsedEvent {
  event: NormalizedEvent;
  workflowHint: string;
  runKey: string;
  sequence: number;
  minutesSpent: number;
  occurredAtMs: number;
}

interface SequenceStats {
  total: number;
  attributions: Map<string, number>;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSequence(value: unknown): number | null {
  if (Number.isInteger(value)) {
    const sequence = Number(value);
    if (sequence >= MIN_SEQUENCE && sequence <= MAX_SEQUENCE) {
      return sequence;
    }
    return null;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const sequence = Number(value.trim());
    if (sequence >= MIN_SEQUENCE && sequence <= MAX_SEQUENCE) {
      return sequence;
    }
  }

  return null;
}

function parseMinutesSpent(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }

  return 5;
}

function workflowNameFromKey(workflowKey: string): string {
  return workflowKey
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function parseEvent(event: NormalizedEvent): ParsedEvent | null {
  const occurredAtMs = new Date(event.occurredAt).getTime();
  if (!Number.isFinite(occurredAtMs)) {
    return null;
  }

  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};

  const workflowHint = normalizedString(payload.workflowHint) ?? 'generic-workflow';
  const runKey =
    normalizedString(payload.runKey) ?? `${workflowHint}::${event.provider.toLowerCase()}::${event.externalId}`;
  const sequence = parseSequence(payload.sequence) ?? MAX_SEQUENCE;
  const minutesSpent = parseMinutesSpent(payload.minutesSpent);

  return {
    event,
    workflowHint,
    runKey,
    sequence,
    minutesSpent,
    occurredAtMs
  };
}

function sortRunEvents(a: ParsedEvent, b: ParsedEvent): number {
  if (a.sequence !== b.sequence) {
    return a.sequence - b.sequence;
  }

  if (a.occurredAtMs !== b.occurredAtMs) {
    return a.occurredAtMs - b.occurredAtMs;
  }

  return a.event.externalId.localeCompare(b.event.externalId);
}

function chooseDominantAttribution(attributions: Map<string, number>): {
  actor: string;
  tool: string;
  action: string;
  count: number;
} {
  const entries = [...attributions.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return a[0].localeCompare(b[0]);
  });

  const [selectedKey, selectedCount] = entries[0] ?? ['unknown|unknown|unknown', 0];
  const [actor, tool, action] = selectedKey.split('|');

  return {
    actor: actor ?? 'unknown',
    tool: tool ?? 'unknown',
    action: action ?? 'unknown',
    count: selectedCount
  };
}

function buildClusterConfidence(input: {
  runCount: number;
  totalEvents: number;
  nodeConfidences: number[];
  edgeConfidences: number[];
  stepCountsByRun: number[];
  maxStepCount: number;
}): number {
  const recurrenceScore = clamp01(input.runCount / 12);

  const expectedEvents = Math.max(1, input.runCount * Math.max(1, input.maxStepCount));
  const eventCoverageScore = clamp01(input.totalEvents / expectedEvents);

  const avgStepCount = mean(input.stepCountsByRun);
  const stepStdDev = standardDeviation(input.stepCountsByRun);
  const stepConsistencyScore =
    avgStepCount <= 0 ? 0 : clamp01(1 - stepStdDev / Math.max(1, avgStepCount));

  const transitionStabilityScore =
    input.edgeConfidences.length === 0 ? 0 : mean(input.edgeConfidences);

  const attributionStabilityScore =
    input.nodeConfidences.length === 0 ? 0 : mean(input.nodeConfidences);

  return round4(
    clamp01(
      recurrenceScore * 0.3 +
        eventCoverageScore * 0.25 +
        stepConsistencyScore * 0.2 +
        transitionStabilityScore * 0.15 +
        attributionStabilityScore * 0.1
    )
  );
}

export function extractWorkflows(events: NormalizedEvent[]): WorkflowExtractionResult[] {
  const nowMs = Date.now();
  const byWorkflowHint = new Map<string, ParsedEvent[]>();

  for (const event of events) {
    const parsed = parseEvent(event);
    if (!parsed) {
      continue;
    }

    if (nowMs - parsed.occurredAtMs > THIRTY_DAYS_MS) {
      continue;
    }

    const list = byWorkflowHint.get(parsed.workflowHint) ?? [];
    list.push(parsed);
    byWorkflowHint.set(parsed.workflowHint, list);
  }

  const output: WorkflowExtractionResult[] = [];

  for (const [workflowKey, workflowEvents] of [...byWorkflowHint.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const runs = new Map<string, ParsedEvent[]>();
    for (const event of workflowEvents) {
      const runEvents = runs.get(event.runKey) ?? [];
      runEvents.push(event);
      runs.set(event.runKey, runEvents);
    }

    if (runs.size < MIN_RECURRING_RUNS) {
      continue;
    }

    const sequenceStats = new Map<number, SequenceStats>();
    const edgeCounts = new Map<string, number>();
    const edgeSourceTotals = new Map<number, number>();
    const runMinuteTotals: number[] = [];
    const stepCountsByRun: number[] = [];

    const sortedRunEntries = [...runs.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [, runEvents] of sortedRunEntries) {
      const sortedRunEvents = [...runEvents].sort(sortRunEvents);
      const seenSequence = new Set<number>();
      const runPath: number[] = [];
      let runMinutes = 0;

      for (const runEvent of sortedRunEvents) {
        const stats = sequenceStats.get(runEvent.sequence) ?? {
          total: 0,
          attributions: new Map<string, number>()
        };
        stats.total += 1;
        const attributionKey = `${runEvent.event.actor}|${runEvent.event.tool}|${runEvent.event.action}`;
        stats.attributions.set(attributionKey, (stats.attributions.get(attributionKey) ?? 0) + 1);
        sequenceStats.set(runEvent.sequence, stats);

        runMinutes += runEvent.minutesSpent;

        if (!seenSequence.has(runEvent.sequence)) {
          seenSequence.add(runEvent.sequence);
          runPath.push(runEvent.sequence);
        }
      }

      runMinuteTotals.push(runMinutes);
      stepCountsByRun.push(runPath.length);

      for (let i = 0; i < runPath.length - 1; i += 1) {
        const fromSequence = runPath[i];
        const toSequence = runPath[i + 1];
        const edgeKey = `${fromSequence}->${toSequence}`;
        edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
        edgeSourceTotals.set(fromSequence, (edgeSourceTotals.get(fromSequence) ?? 0) + 1);
      }
    }

    const totalEvents = workflowEvents.length;

    const nodes = [...sequenceStats.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sequence, stats]) => {
        const dominant = chooseDominantAttribution(stats.attributions);
        const dominanceRatio = stats.total === 0 ? 0 : dominant.count / stats.total;
        const supportRatio = totalEvents === 0 ? 0 : stats.total / totalEvents;
        const nodeConfidence = round4(clamp01(0.45 + dominanceRatio * 0.4 + supportRatio * 0.15));

        return {
          actor: dominant.actor,
          tool: dominant.tool,
          action: dominant.action,
          sequence,
          confidence: nodeConfidence
        };
      });

    const edges = [...edgeCounts.entries()]
      .map(([edgeKey, count]) => {
        const [fromRaw, toRaw] = edgeKey.split('->');
        const fromSequence = Number(fromRaw);
        const toSequence = Number(toRaw);
        const denominator = Math.max(1, edgeSourceTotals.get(fromSequence) ?? 1);
        return {
          fromSequence,
          toSequence,
          confidence: round4(clamp01(count / denominator))
        };
      })
      .sort(
        (a, b) => a.fromSequence - b.fromSequence || a.toSequence - b.toSequence
      );

    if (nodes.length === 0) {
      continue;
    }

    const avgMinutesPerRun = runMinuteTotals.length > 0 ? round2(mean(runMinuteTotals)) : 5;
    const monthlyRuns = runs.size;
    const confidence = buildClusterConfidence({
      runCount: runs.size,
      totalEvents,
      nodeConfidences: nodes.map((node) => node.confidence),
      edgeConfidences: edges.map((edge) => edge.confidence),
      stepCountsByRun,
      maxStepCount: Math.max(...nodes.map((node) => node.sequence), 1)
    });

    output.push({
      workflowKey,
      workflowName: workflowNameFromKey(workflowKey),
      confidence,
      avgMinutesPerRun,
      monthlyRuns,
      nodes,
      edges
    });
  }

  return output.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.monthlyRuns - a.monthlyRuns ||
      a.workflowKey.localeCompare(b.workflowKey)
  );
}
