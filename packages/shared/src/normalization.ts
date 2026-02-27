import { Provider } from '@nexus/contracts';

export interface NormalizeRawConnectorEventInput {
  provider: Provider;
  externalId: string;
  payload: unknown;
}

export interface CanonicalNormalizedEvent {
  actor: string;
  tool: 'Slack' | 'Gmail' | 'GitHub' | 'Notion' | 'Linear' | 'Jira' | 'GCal';
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

function deriveSlackWorkflowHint(channel: string | null): string {
  if (!channel) return 'slack-general';
  // Normalize channel ID or name into a readable workflow hint
  const cleaned = channel.replace(/^#/, '').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  return `slack-${cleaned || 'general'}`;
}

function deriveSlackRunKey(channel: string | null, ts: string | null): string {
  // Group messages by channel + day for daily conversation "runs"
  const channelPart = channel ?? 'unknown';
  if (ts) {
    const tsNumeric = Number(ts);
    if (Number.isFinite(tsNumeric)) {
      const date = new Date(Math.floor(tsNumeric * 1000));
      const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      return `${channelPart}:${dayKey}`;
    }
  }
  return `${channelPart}:${Date.now()}`;
}

function deriveSlackActor(payload: Record<string, unknown>): string {
  return asOptionalString(payload.user) ?? asOptionalString(payload.actor) ?? 'unknown';
}

function normalizeSlack(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const channel = asOptionalString(input.payload.channel);
  const ts = asOptionalString(input.payload.ts);
  const text = asOptionalString(input.payload.text);
  const subtype = asOptionalString(input.payload.subtype);

  // Use explicit workflowHint if present (fixtures), otherwise auto-derive from channel
  const explicitHint = asOptionalString(input.payload.workflowHint);
  const workflowHint = explicitHint ?? deriveSlackWorkflowHint(channel);

  const explicitSequence = parseSequence(input.payload.sequence);
  // For real data: assign sequence 2 (triage) as default — most channel messages are conversation
  const sequence = explicitSequence ?? 2;

  const explicitRunKey = asOptionalString(input.payload.runKey);
  const runKey = explicitRunKey ?? deriveSlackRunKey(channel, ts);

  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, 3);
  const actor = deriveSlackActor(input.payload);

  // No errors for missing hint/sequence on real data — those are expected
  return {
    actor,
    tool: 'Slack',
    action: subtype === 'channel_join' ? 'channel_join'
      : subtype === 'bot_message' ? 'bot_notification'
        : text && text.length > 200 ? 'detailed_message'
          : 'message',
    channel,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'SLACK',
        channel,
        ts,
        text,
        subtype
      }
    },
    malformed: false,
    failureReason: null
  };
}

function deriveGmailWorkflowHint(subject: string | null, labelIds: string[]): string {
  if (!subject) {
    if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'gmail-promotions';
    if (labelIds.includes('CATEGORY_UPDATES')) return 'gmail-updates';
    if (labelIds.includes('CATEGORY_SOCIAL')) return 'gmail-social';
    return 'gmail-general';
  }

  // Strip Re:/Fwd: prefixes, numbers, dates, and normalize
  let pattern = subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .replace(/\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/g, '') // dates
    .replace(/\b\d{4,}\b/g, '')   // long numbers (ticket IDs, etc.)
    .replace(/#\d+/g, '')          // issue/ticket numbers
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Truncate to first 5 meaningful words for pattern grouping
  const words = pattern.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
  if (words.length === 0) return 'gmail-general';

  const slug = words.join('-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 40);
  return `gmail-${slug || 'general'}`;
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

  const threadId = asOptionalString(input.payload.threadId);
  const from = asOptionalString(input.payload.from);
  const subject = asOptionalString(input.payload.subject);
  const snippet = asOptionalString(input.payload.snippet);
  const historyId = asOptionalString(input.payload.historyId);

  // Use explicit workflowHint if present (fixtures), otherwise auto-derive from subject
  const explicitHint = asOptionalString(input.payload.workflowHint);
  const workflowHint = explicitHint ?? deriveGmailWorkflowHint(subject, labelIds);

  const parsedSequence = parseSequence(input.payload.sequence);
  const sequence = parsedSequence ?? (outbound ? 3 : 1);

  const explicitRunKey = asOptionalString(input.payload.runKey);
  const runKey = explicitRunKey ?? threadId ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, outbound ? 8 : 3);

  return {
    actor: outbound ? (from ?? 'outbound-sender') : (from ?? 'inbound-sender'),
    tool: 'Gmail',
    action: outbound ? 'send_reply' : 'receive_email',
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
    malformed: false,
    failureReason: null
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

function deriveGCalWorkflowHint(title: string): string {
  if (!title) return 'gcal-meeting';

  const pattern = title
    .replace(/\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/g, '') // dates
    .replace(/\b\d{4,}\b/g, '')   // long numbers
    .replace(/#\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const words = pattern.split(/\s+/).filter(w => w.length > 1).slice(0, 4);
  if (words.length === 0) return 'gcal-meeting';

  const slug = words.join('-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 35);
  return `gcal-${slug || 'meeting'}`;
}

function normalizeGCal(input: {
  externalId: string;
  payload: Record<string, unknown>;
  errors: string[];
}): CanonicalNormalizedEvent {
  const title = (typeof input.payload.title === 'string' ? input.payload.title : '') as string;

  const explicitHint = typeof input.payload.workflowHint === 'string' ? input.payload.workflowHint : null;
  const workflowHint = explicitHint ?? deriveGCalWorkflowHint(title);

  const sequence = parseSequence(input.payload.sequence) ?? 1;
  const durationMinutes = parseMinutesSpent(input.payload.durationMinutes, 30);
  const attendeeCount = typeof input.payload.attendeeCount === 'number' ? input.payload.attendeeCount : 0;
  const isRecurring = Boolean(input.payload.isRecurring);

  // Use recurring event ID or title pattern + week as runKey
  const explicitRunKey = typeof input.payload.runKey === 'string' ? input.payload.runKey : null;
  const runKey = explicitRunKey ?? input.externalId;
  const minutesSpent = parseMinutesSpent(input.payload.minutesSpent, durationMinutes);
  const channel = asOptionalString(input.payload.channel);

  // Determine action based on meeting characteristics
  const action = attendeeCount > 5 ? 'large_meeting'
    : durationMinutes >= 60 ? 'long_meeting'
      : isRecurring ? 'recurring_meeting'
        : 'meeting';

  return {
    actor: asOptionalString(input.payload.organizer) ?? 'unknown',
    tool: 'GCal',
    action,
    channel,
    payload: {
      workflowHint,
      sequence,
      runKey,
      minutesSpent,
      source: {
        provider: 'GCAL',
        title,
        durationMinutes,
        attendeeCount,
        organizer: asOptionalString(input.payload.organizer),
        isRecurring,
        hasVideoConference: Boolean(input.payload.hasVideoConference)
      }
    },
    malformed: false,
    failureReason: null
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

  if (input.provider === 'GCAL') {
    return normalizeGCal({ externalId: input.externalId, payload, errors });
  }

  // Default: GMAIL
  return normalizeGmail({ externalId: input.externalId, payload, errors });
}
