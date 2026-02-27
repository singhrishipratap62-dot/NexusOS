import { Provider } from '@nexus/contracts';

export interface RawConnectorEvent {
  provider: Provider;
  externalId: string;
  occurredAt: string;
  actor: string;
  channel?: string;
  payload: Record<string, unknown>;
}

function daysAgo(days: number, hourOffset = 0): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  date.setUTCHours((9 + hourOffset) % 24, 0, 0, 0);
  return date.toISOString();
}

export function loadGitHubAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 12; run++) {
    const day = run % 28;
    const runKey = `nexusos-main-pr-${run}`;
    const repo = 'acme/nexusos';

    // PR opened (sequence 1)
    events.push({
      provider: 'GITHUB',
      externalId: `github-${repo.replace('/', '-')}-pr-${run}`,
      occurredAt: daysAgo(day, 1),
      actor: 'dev-lead',
      channel: repo,
      payload: {
        type: 'pull_request',
        number: run,
        title: `Feature branch ${run}: add automation step`,
        state: 'open',
        repo,
        html_url: `https://github.com/${repo}/pull/${run}`,
        closed_at: null,
        workflowHint: 'code-review-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 45
      }
    });

    // PR reviewed (sequence 2)
    events.push({
      provider: 'GITHUB',
      externalId: `github-${repo.replace('/', '-')}-review-${run}`,
      occurredAt: daysAgo(day, 3),
      actor: 'senior-engineer',
      channel: repo,
      payload: {
        type: 'pull_request_review',
        number: run,
        title: `Review of PR ${run}`,
        state: 'open',
        repo,
        html_url: `https://github.com/${repo}/pull/${run}`,
        closed_at: null,
        workflowHint: 'code-review-workflow',
        sequence: 2,
        runKey,
        minutesSpent: 30
      }
    });

    // PR merged (sequence 3)
    events.push({
      provider: 'GITHUB',
      externalId: `github-${repo.replace('/', '-')}-merged-${run}`,
      occurredAt: daysAgo(day, 6),
      actor: 'dev-lead',
      channel: repo,
      payload: {
        type: 'pull_request',
        number: run,
        title: `Feature branch ${run}: add automation step`,
        state: 'closed',
        repo,
        html_url: `https://github.com/${repo}/pull/${run}`,
        closed_at: daysAgo(day, 6),
        workflowHint: 'code-review-workflow',
        sequence: 3,
        runKey,
        minutesSpent: 10
      }
    });
  }

  return events;
}

export function loadNotionAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 10; run++) {
    const day = run % 28;
    const pageId = `notion-page-${run.toString().padStart(8, '0')}`;
    const runKey = pageId;

    // Page created (sequence 1)
    events.push({
      provider: 'NOTION',
      externalId: `notion-page-created-${run}`,
      occurredAt: daysAgo(day, 0),
      actor: 'content-writer',
      payload: {
        pageId,
        type: 'page_created',
        created_time: daysAgo(day, 0),
        last_edited_time: daysAgo(day, 0),
        workflowHint: 'knowledge-base-update',
        sequence: 1,
        runKey,
        minutesSpent: 30
      }
    });

    // Page reviewed/edited (sequence 2)
    events.push({
      provider: 'NOTION',
      externalId: `notion-page-edited-${run}`,
      occurredAt: daysAgo(day, 4),
      actor: 'content-reviewer',
      payload: {
        pageId,
        type: 'page_updated',
        created_time: daysAgo(day, 0),
        last_edited_time: daysAgo(day, 4),
        workflowHint: 'knowledge-base-update',
        sequence: 2,
        runKey,
        minutesSpent: 15
      }
    });

    // Page published (sequence 3)
    events.push({
      provider: 'NOTION',
      externalId: `notion-page-published-${run}`,
      occurredAt: daysAgo(day, 7),
      actor: 'content-lead',
      payload: {
        pageId,
        type: 'page_published',
        created_time: daysAgo(day, 0),
        last_edited_time: daysAgo(day, 7),
        workflowHint: 'knowledge-base-update',
        sequence: 3,
        runKey,
        minutesSpent: 10
      }
    });
  }

  return events;
}

export function loadLinearAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 15; run++) {
    const day = run % 28;
    const issueId = `linear-issue-${run.toString().padStart(6, '0')}`;
    const runKey = issueId;

    // Issue created / backlog (sequence 1)
    events.push({
      provider: 'LINEAR',
      externalId: `linear-issue-created-${run}`,
      occurredAt: daysAgo(day, 0),
      actor: 'product-manager',
      channel: 'ENG',
      payload: {
        id: issueId,
        identifier: `ENG-${100 + run}`,
        title: `Bug: edge case in workflow executor ${run}`,
        stateName: 'Todo',
        stateType: 'unstarted',
        teamName: 'Engineering',
        teamKey: 'ENG',
        priority: 2,
        estimate: 2,
        completedAt: null,
        workflowHint: 'bug-triage-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 20
      }
    });

    // Issue in progress (sequence 2)
    events.push({
      provider: 'LINEAR',
      externalId: `linear-issue-inprogress-${run}`,
      occurredAt: daysAgo(day, 3),
      actor: 'engineer',
      channel: 'ENG',
      payload: {
        id: issueId,
        identifier: `ENG-${100 + run}`,
        title: `Bug: edge case in workflow executor ${run}`,
        stateName: 'In Progress',
        stateType: 'started',
        teamName: 'Engineering',
        teamKey: 'ENG',
        priority: 2,
        estimate: 2,
        completedAt: null,
        workflowHint: 'bug-triage-workflow',
        sequence: 2,
        runKey,
        minutesSpent: 60
      }
    });

    // Issue completed (sequence 3)
    events.push({
      provider: 'LINEAR',
      externalId: `linear-issue-completed-${run}`,
      occurredAt: daysAgo(day, 6),
      actor: 'engineer',
      channel: 'ENG',
      payload: {
        id: issueId,
        identifier: `ENG-${100 + run}`,
        title: `Bug: edge case in workflow executor ${run}`,
        stateName: 'Done',
        stateType: 'completed',
        teamName: 'Engineering',
        teamKey: 'ENG',
        priority: 2,
        estimate: 2,
        completedAt: daysAgo(day, 6),
        workflowHint: 'bug-triage-workflow',
        sequence: 3,
        runKey,
        minutesSpent: 15
      }
    });
  }

  return events;
}

export function loadJiraAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 14; run++) {
    const day = run % 28;
    const issueKey = `NEXUS-${100 + run}`;
    const runKey = issueKey;

    // Issue created / To Do (sequence 1)
    events.push({
      provider: 'JIRA',
      externalId: `jira-issue-created-${run}`,
      occurredAt: daysAgo(day, 0),
      actor: 'scrum-master',
      channel: 'NEXUS',
      payload: {
        id: `jira-${run}`,
        key: issueKey,
        summary: `Sprint story ${run}: implement connector ingestion`,
        statusName: 'To Do',
        statusCategory: 'new',
        projectKey: 'NEXUS',
        projectName: 'NexusOS',
        issuetype: 'Story',
        priority: 'Medium',
        resolutiondate: null,
        timeSpentSeconds: null,
        workflowHint: 'sprint-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 25
      }
    });

    // Issue in progress (sequence 2)
    events.push({
      provider: 'JIRA',
      externalId: `jira-issue-inprogress-${run}`,
      occurredAt: daysAgo(day, 2),
      actor: 'developer',
      channel: 'NEXUS',
      payload: {
        id: `jira-${run}`,
        key: issueKey,
        summary: `Sprint story ${run}: implement connector ingestion`,
        statusName: 'In Progress',
        statusCategory: 'indeterminate',
        projectKey: 'NEXUS',
        projectName: 'NexusOS',
        issuetype: 'Story',
        priority: 'Medium',
        resolutiondate: null,
        timeSpentSeconds: 3600,
        workflowHint: 'sprint-workflow',
        sequence: 2,
        runKey,
        minutesSpent: 60
      }
    });

    // Issue done (sequence 3)
    events.push({
      provider: 'JIRA',
      externalId: `jira-issue-done-${run}`,
      occurredAt: daysAgo(day, 5),
      actor: 'developer',
      channel: 'NEXUS',
      payload: {
        id: `jira-${run}`,
        key: issueKey,
        summary: `Sprint story ${run}: implement connector ingestion`,
        statusName: 'Done',
        statusCategory: 'done',
        projectKey: 'NEXUS',
        projectName: 'NexusOS',
        issuetype: 'Story',
        priority: 'Medium',
        resolutiondate: daysAgo(day, 5),
        timeSpentSeconds: 7200,
        workflowHint: 'sprint-workflow',
        sequence: 3,
        runKey,
        minutesSpent: 20
      }
    });
  }

  return events;
}

export function loadSlackAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 18; run += 1) {
    const day = run % 28;
    const runKey = `support-${run}`;
    events.push({
      provider: 'SLACK',
      externalId: `slack-triage-${run}`,
      occurredAt: daysAgo(day, 2),
      actor: 'support-lead',
      channel: '#support-triage',
      payload: {
        text: `Investigate customer escalation ${run}`,
        channel: '#support-triage',
        workflowHint: 'customer-escalation-resolution',
        sequence: 2,
        runKey,
        minutesSpent: 11
      }
    });

    events.push({
      provider: 'SLACK',
      externalId: `slack-status-${run}`,
      occurredAt: daysAgo(day, 5),
      actor: 'support-lead',
      channel: '#ops-updates',
      payload: {
        text: `Status update posted for escalation ${run}`,
        channel: '#ops-updates',
        workflowHint: 'customer-escalation-resolution',
        sequence: 4,
        runKey,
        minutesSpent: 4
      }
    });
  }

  return events;
}

export function loadGmailAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  for (let run = 1; run <= 18; run += 1) {
    const day = run % 28;
    const runKey = `support-${run}`;

    events.push({
      provider: 'GMAIL',
      externalId: `gmail-inbound-${run}`,
      occurredAt: daysAgo(day, 0),
      actor: 'customer',
      payload: {
        subject: `Escalation ${run}`,
        workflowHint: 'customer-escalation-resolution',
        sequence: 1,
        runKey,
        minutesSpent: 7
      }
    });

    events.push({
      provider: 'GMAIL',
      externalId: `gmail-reply-${run}`,
      occurredAt: daysAgo(day, 4),
      actor: 'support-agent',
      payload: {
        subject: `Resolution ${run}`,
        workflowHint: 'customer-escalation-resolution',
        sequence: 3,
        runKey,
        minutesSpent: 14
      }
    });
  }

  return events;
}

export function loadGCalAuditFixtures(): RawConnectorEvent[] {
  const events: RawConnectorEvent[] = [];

  // Daily standups
  for (let run = 1; run <= 20; run++) {
    const day = run % 28;
    const runKey = `standup-${run}`;
    events.push({
      provider: 'GCAL',
      externalId: `gcal-standup-${run}`,
      occurredAt: daysAgo(day, 0),
      actor: 'eng-manager',
      channel: 'Engineering Calendar',
      payload: {
        type: 'calendar_event',
        title: 'Daily Standup',
        durationMinutes: 15,
        attendeeCount: 6,
        organizer: 'eng-manager@company.com',
        isRecurring: true,
        hasVideoConference: true,
        workflowHint: 'daily-standup-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 15
      }
    });
  }

  // Sprint planning
  for (let run = 1; run <= 4; run++) {
    const day = run * 7;
    const runKey = `sprint-planning-${run}`;
    events.push({
      provider: 'GCAL',
      externalId: `gcal-sprint-${run}`,
      occurredAt: daysAgo(day, 2),
      actor: 'scrum-master',
      channel: 'Engineering Calendar',
      payload: {
        type: 'calendar_event',
        title: 'Sprint Planning',
        durationMinutes: 60,
        attendeeCount: 8,
        organizer: 'scrum-master@company.com',
        isRecurring: true,
        hasVideoConference: true,
        workflowHint: 'sprint-ceremony-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 60
      }
    });
  }

  // 1:1s
  for (let run = 1; run <= 8; run++) {
    const day = (run * 3) % 28;
    const runKey = `one-on-one-${run}`;
    events.push({
      provider: 'GCAL',
      externalId: `gcal-1on1-${run}`,
      occurredAt: daysAgo(day, 4),
      actor: 'eng-manager',
      channel: 'Engineering Calendar',
      payload: {
        type: 'calendar_event',
        title: `1:1 with Engineer ${run}`,
        durationMinutes: 30,
        attendeeCount: 2,
        organizer: 'eng-manager@company.com',
        isRecurring: true,
        hasVideoConference: true,
        workflowHint: 'one-on-one-workflow',
        sequence: 1,
        runKey,
        minutesSpent: 30
      }
    });
  }

  return events;
}
