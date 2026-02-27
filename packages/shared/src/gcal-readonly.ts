export interface GCalCheckpoint {
    updatedMin?: string;
    syncedAt?: string;
}

export interface GCalPullEvent {
    externalId: string;
    occurredAt: string;
    actor: string;
    channel: string; // calendar name
    payload: Record<string, unknown>;
}

export interface GCalPullOptions {
    checkpoint?: GCalCheckpoint;
    calendarId?: string;
    oldestFallbackDays?: number;
}

export interface GCalPullResult {
    events: GCalPullEvent[];
    checkpoint: GCalCheckpoint;
    requestCount: number;
}

interface GCalEvent {
    id?: string;
    summary?: string;
    description?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    organizer?: { email?: string; displayName?: string };
    attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
    created?: string;
    updated?: string;
    htmlLink?: string;
    recurringEventId?: string;
    conferenceData?: {
        entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
}

interface GCalListResponse {
    items?: GCalEvent[];
    nextPageToken?: string;
    error?: { code?: number; message?: string };
}

interface GCalCalendarListEntry {
    id?: string;
    summary?: string;
    primary?: boolean;
}

interface GCalCalendarListResponse {
    items?: GCalCalendarListEntry[];
    error?: { code?: number; message?: string };
}

export class GCalReadOnlyConnector {
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;
    private readonly maxRetries: number;
    private readonly initialBackoffMs: number;

    constructor(
        private readonly accessToken: string,
        options?: {
            baseUrl?: string;
            fetchImpl?: typeof fetch;
            maxRetries?: number;
            initialBackoffMs?: number;
        }
    ) {
        this.baseUrl = options?.baseUrl ?? 'https://www.googleapis.com/calendar/v3';
        this.fetchImpl = options?.fetchImpl ?? fetch;
        this.maxRetries = options?.maxRetries ?? 4;
        this.initialBackoffMs = options?.initialBackoffMs ?? 350;
    }

    private async wait(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private backoffMs(attempt: number): number {
        return this.initialBackoffMs * 2 ** attempt;
    }

    private async request<T>(
        path: string,
        params: Record<string, string | number | boolean | undefined> = {}
    ): Promise<T> {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                query.set(key, String(value));
            }
        }

        const qs = query.toString();
        const url = `${this.baseUrl}${path}${qs ? '?' + qs : ''}`;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.fetchImpl(url, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        Accept: 'application/json'
                    }
                });

                if (response.status === 429 || response.status === 403) {
                    if (attempt < this.maxRetries) {
                        const retryAfter = Number(response.headers.get('retry-after') ?? '5');
                        await this.wait(Math.max(retryAfter, 1) * 1000);
                        continue;
                    }
                    throw new Error(`Google Calendar API ${path} rate limited after retries`);
                }

                if (response.status === 401) {
                    throw new Error(`Google Calendar API ${path} unauthorized: check token permissions`);
                }

                if (!response.ok) {
                    if (response.status >= 500 && attempt < this.maxRetries) {
                        await this.wait(this.backoffMs(attempt));
                        continue;
                    }
                    throw new Error(`Google Calendar API ${path} failed: ${response.status}`);
                }

                return (await response.json()) as T;
            } catch (error) {
                if (attempt >= this.maxRetries) throw error;
                await this.wait(this.backoffMs(attempt));
            }
        }

        throw new Error(`Google Calendar API ${path} failed after retries`);
    }

    private computeDurationMinutes(event: GCalEvent): number {
        const startStr = event.start?.dateTime ?? event.start?.date;
        const endStr = event.end?.dateTime ?? event.end?.date;

        if (!startStr || !endStr) return 30; // default

        const startMs = new Date(startStr).getTime();
        const endMs = new Date(endStr).getTime();
        const minutes = Math.round((endMs - startMs) / 60000);
        return minutes > 0 ? minutes : 30;
    }

    async pullEvents(options?: GCalPullOptions): Promise<GCalPullResult> {
        const checkpoint = options?.checkpoint ?? {};
        const calendarId = options?.calendarId ?? 'primary';
        const updatedMin =
            checkpoint.updatedMin ??
            new Date(
                Date.now() - (options?.oldestFallbackDays ?? 30) * 24 * 60 * 60 * 1000
            ).toISOString();

        const events: GCalPullEvent[] = [];
        let requestCount = 0;
        let pageToken: string | undefined;
        let maxUpdated = updatedMin;

        // Get calendar name for channel
        let calendarName = calendarId;
        try {
            const calList = await this.request<GCalCalendarListResponse>('/users/me/calendarList');
            requestCount++;
            const cal = calList.items?.find((c) => c.id === calendarId || (calendarId === 'primary' && c.primary));
            if (cal?.summary) calendarName = cal.summary;
        } catch {
            // Use calendarId as fallback
        }

        do {
            const page = await this.request<GCalListResponse>(
                `/calendars/${encodeURIComponent(calendarId)}/events`,
                {
                    updatedMin,
                    singleEvents: true,
                    orderBy: 'updated',
                    maxResults: 250,
                    pageToken
                }
            );
            requestCount++;

            for (const event of page.items ?? []) {
                if (!event.id || event.status === 'cancelled') continue;

                const occurredAt = event.start?.dateTime ?? event.start?.date ?? event.updated ?? '';
                if (event.updated && event.updated > maxUpdated) {
                    maxUpdated = event.updated;
                }

                const durationMinutes = this.computeDurationMinutes(event);
                const attendeeCount = event.attendees?.length ?? 0;

                events.push({
                    externalId: `gcal-${event.id}`,
                    occurredAt,
                    actor: event.organizer?.email ?? event.organizer?.displayName ?? 'unknown',
                    channel: calendarName,
                    payload: {
                        type: 'calendar_event',
                        title: event.summary ?? 'Untitled',
                        durationMinutes,
                        attendeeCount,
                        organizer: event.organizer?.email ?? null,
                        isRecurring: Boolean(event.recurringEventId),
                        hasVideoConference: Boolean(
                            event.conferenceData?.entryPoints?.some((ep) => ep.entryPointType === 'video')
                        ),
                        workflowHint: this.inferWorkflowHint(event),
                        sequence: 1,
                        runKey: event.recurringEventId ?? event.id,
                        minutesSpent: durationMinutes
                    }
                });
            }

            pageToken = page.nextPageToken;
        } while (pageToken);

        return {
            events,
            checkpoint: {
                updatedMin: maxUpdated,
                syncedAt: new Date().toISOString()
            },
            requestCount
        };
    }

    private inferWorkflowHint(event: GCalEvent): string {
        const title = (event.summary ?? '').toLowerCase();
        const attendeeCount = event.attendees?.length ?? 0;
        const duration = this.computeDurationMinutes(event);

        if (title.includes('standup') || title.includes('stand-up') || title.includes('daily sync')) {
            return 'daily-standup-workflow';
        }
        if (title.includes('sprint') || title.includes('planning') || title.includes('retro')) {
            return 'sprint-ceremony-workflow';
        }
        if (title.includes('1:1') || title.includes('1-1') || (attendeeCount === 2 && duration <= 30)) {
            return 'one-on-one-workflow';
        }
        if (title.includes('interview') || title.includes('screening')) {
            return 'hiring-workflow';
        }
        if (attendeeCount > 5) {
            return 'large-meeting-workflow';
        }

        return 'meeting-workflow';
    }
}
