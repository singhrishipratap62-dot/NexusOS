import { Provider } from '@nexus/contracts';

export interface NormalizeRawConnectorEventInput {
  provider: Provider;
  externalId: string;
  payload: unknown;
}

export interface CanonicalNormalizedEvent {
  actor: string;
  tool: 'Slack' | 'Gmail' | 'GitHub' | 'Notion' | 'Linear' | 'Jira';
  action: string;
  channel: string | null;
  payload: Record<string, unknown>;
  malformed: boolean;
  failureReason: string | null;
}

function inferAction(sequence: number): string {
  if (sequence === 1) {
    return 'intake_customer_request';
  }
  if (sequence === 2) {
    return 'triage_request';
  }
  if (sequence === 3) {
    return 'respond_to_customer';
  }
  if (sequence === 4) {
    return 'publish_internal_update';
  }

  return `workflow_step_${sequence}`;
}

function asRecord(payload: unknown, errors: string[]): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Payload must be a JSON object.');
    return {};
  }

  return payload as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseSequence(value: unknown): number | null {
  if (Number.isInteger(value)) {
    const sequence = Number(value);
    return sequence >= 1 && sequence <= 20 ? sequence : null;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const sequence = Number(value.trim());
    return sequence >= 1 && sequence <= 20 ? sequence : null;
  }

  return null;
}

function parseMinutesSpent(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }

  return fallback;
}

function normalizeSlack(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'slack-support-triage';
  if (asOptionalString(input.payload.workflowHint) === null) {
    input.errors.push('workflowHint missing or invalid.');
  }

  const sequence = parseSequence(input.payload.sequence) ?? 99;
  if (parseSequence(input.payload.sequence) === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const channel = asOptionalString(input.payload.channel);
  const runKey = asOptionalString(input.payload.runKey) ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 5);

  return {
    actor: 'support-lead',
    tool: 'Slack',
    action: inferAction(sequence),
    channel,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'SLACK',
        channel,
        ts: asOptionalString(input.payload.ts),
        text: asOptionalString(input.payload.text),
        subtype: asOptionalString(input.payload.subtype)
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

function normalizeGmail(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const labelIds = asStringArray(input.payload.labelIds);
  const outbound =
    labelIds.includes('SENT') ||
    input.externalId.toLowerCase().includes('reply') ||
    input.externalId.toLowerCase().includes('outbound');

  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'customer-escalation-resolution';
  if (asOptionalString(input.payload.workflowHint) === null) {
    input.errors.push('workflowHint missing or invalid.');
  }

  const parsedSequence = parseSequence(input.payload.sequence);
  const sequence = parsedSequence ?? (outbound ? 3 : 1);
  if (parsedSequence === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const threadId = asOptionalString(input.payload.threadId);
  const historyId = asOptionalString(input.payload.historyId);
  const from = asOptionalString(input.payload.from);
  const subject = asOptionalString(input.payload.subject);
  const snippet = asOptionalString(input.payload.snippet);
  const runKey = asOptionalString(input.payload.runKey) ?? threadId ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, outbound ? 14 : 7);

  return {
    actor: outbound ? 'support-agent' : 'customer',
    tool: 'Gmail',
    action: inferAction(sequence),
    channel: null,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'GMAIL',
        threadId,
        historyId,
        from,
        subject,
        snippet,
        labelIds
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

function normalizeGitHub(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const type = asOptionalString(input.payload.type) ?? 'unknown';
  const repo = asOptionalString(input.payload.repo);
  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'code-review-workflow';

  const sequence = parseSequence(input.payload.sequence) ?? 1;
  if (parseSequence(input.payload.sequence) === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const runKey = asOptionalString(input.payload.runKey) ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 30);

  return {
    actor: asOptionalString(input.payload.actor) ?? 'unknown',
    tool: 'GitHub',
    action: inferAction(sequence),
    channel: repo,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'GITHUB',
        type,
        number: input.payload.number ?? null,
        title: asOptionalString(input.payload.title),
        state: asOptionalString(input.payload.state),
        repo,
        html_url: asOptionalString(input.payload.html_url),
        closed_at: asOptionalString(input.payload.closed_at as unknown as string)
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

function normalizeNotion(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const type = asOptionalString(input.payload.type) ?? 'page_updated';
  const pageId = asOptionalString(input.payload.pageId);
  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'knowledge-base-update';

  const sequence = parseSequence(input.payload.sequence) ?? 2;
  if (parseSequence(input.payload.sequence) === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const runKey = asOptionalString(input.payload.runKey) ?? pageId ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 20);

  return {
    actor: asOptionalString(input.payload.actor) ?? 'unknown',
    tool: 'Notion',
    action: type === 'page_created' ? 'intake_customer_request' : inferAction(sequence),
    channel: null,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'NOTION',
        type,
        pageId,
        created_time: asOptionalString(input.payload.created_time as unknown as string),
        last_edited_time: asOptionalString(input.payload.last_edited_time as unknown as string)
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

function normalizeLinear(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const identifier = asOptionalString(input.payload.identifier);
  const teamKey = asOptionalString(input.payload.teamKey);
  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'bug-triage-workflow';

  const sequence = parseSequence(input.payload.sequence) ?? 1;
  if (parseSequence(input.payload.sequence) === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const runKey = asOptionalString(input.payload.runKey) ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 40);

  return {
    actor: asOptionalString(input.payload.actor) ?? 'unknown',
    tool: 'Linear',
    action: inferAction(sequence),
    channel: teamKey,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'LINEAR',
        identifier,
        title: asOptionalString(input.payload.title),
        stateName: asOptionalString(input.payload.stateName),
        stateType: asOptionalString(input.payload.stateType),
        teamKey,
        priority: input.payload.priority ?? null,
        estimate: input.payload.estimate ?? null,
        completedAt: asOptionalString(input.payload.completedAt as unknown as string)
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

function normalizeJira(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const issueKey = asOptionalString(input.payload.key);
  const projectKey = asOptionalString(input.payload.projectKey);
  const workflowHint =
    asOptionalString(input.payload.workflowHint) ?? 'sprint-workflow';

  const sequence = parseSequence(input.payload.sequence) ?? 1;
  if (parseSequence(input.payload.sequence) === null) {
    input.errors.push('sequence missing or out of range 1-20.');
  }

  const runKey = asOptionalString(input.payload.runKey) ?? issueKey ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 25);

  return {
    actor: asOptionalString(input.payload.actor) ?? 'unknown',
    tool: 'Jira',
    action: inferAction(sequence),
    channel: projectKey,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'JIRA',
        key: issueKey,
        summary: asOptionalString(input.payload.summary),
        statusName: asOptionalString(input.payload.statusName),
        statusCategory: asOptionalString(input.payload.statusCategory),
        projectKey,
        issuetype: asOptionalString(input.payload.issuetype),
        priority: asOptionalString(input.payload.priority),
        resolutiondate: asOptionalString(input.payload.resolutiondate as unknown as string)
      }
    },
    malformed: input.errors.length > 0,
    failureReason: input.errors.length > 0 ? input.errors.join(' ') : null
  };
}

export function normalizeRawConnectorEvent(
  input: NormalizeRawConnectorEventInput
): CanonicalNormalizedEvent {
  const errors: string[] = [];
  const payload = asRecord(input.payload, errors);

  if (input.provider === 'SLACK') {
    return normalizeSlack({ externalId: input.externalId, payload, errors });
  }

  if (input.provider === 'GITHUB') {
    return normalizeGitHub({ externalId: input.externalId, payload, errors });
  }

  if (input.provider === 'NOTION') {
    return normalizeNotion({ externalId: input.externalId, payload, errors });
  }

  if (input.provider === 'LINEAR') {
    return normalizeLinear({ externalId: input.externalId, payload, errors });
  }

  if (input.provider === 'JIRA') {
    return normalizeJira({ externalId: input.externalId, payload, errors });
  }

  // Default: GMAIL (and GCAL fallback)
  return normalizeGmail({ externalId: input.externalId, payload, errors });
}
