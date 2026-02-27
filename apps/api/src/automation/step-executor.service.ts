import { Injectable, Logger } from '@nestjs/common';
import { AutomationStep } from '@nexus/contracts';

export interface StepResult {
    stepId: string;
    action: string;
    status: 'succeeded' | 'failed' | 'skipped' | 'dry_run';
    output: Record<string, unknown>;
    durationMs: number;
    error?: string;
}

export interface StepContext {
    tenantId: string;
    runId: string;
    dryRun: boolean;
}

const STEP_TIMEOUT_MS = 30_000;
const MAX_STEPS_PER_RUN = 50;

@Injectable()
export class StepExecutorService {
    private readonly logger = new Logger(StepExecutorService.name);

    /**
     * Execute a single automation step.
     * In dry-run mode, logs the action and returns a simulated result.
     */
    async executeStep(step: AutomationStep, context: StepContext): Promise<StepResult> {
        const start = Date.now();

        try {
            if (context.dryRun) {
                this.logger.log(
                    `[DRY-RUN] Run ${context.runId}: Step ${step.id} → ${step.action} on ${step.connectorId}`
                );
                return {
                    stepId: step.id,
                    action: step.action,
                    status: 'dry_run',
                    output: {
                        message: `Dry-run: would execute ${step.action} on ${step.connectorId}`,
                        parameters: step.parameters
                    },
                    durationMs: Date.now() - start
                };
            }

            // Execute with timeout
            const result = await this.withTimeout(
                this.dispatch(step, context),
                STEP_TIMEOUT_MS,
                `Step ${step.id} (${step.action}) timed out after ${STEP_TIMEOUT_MS}ms`
            );

            return {
                stepId: step.id,
                action: step.action,
                status: 'succeeded',
                output: result,
                durationMs: Date.now() - start
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Run ${context.runId}: Step ${step.id} failed: ${message}`);

            return {
                stepId: step.id,
                action: step.action,
                status: 'failed',
                output: {},
                durationMs: Date.now() - start,
                error: message
            };
        }
    }

    /**
     * Execute all steps in a blueprint sequentially.
     * Stops on first failure unless the step is marked as optional.
     */
    async executeAllSteps(
        steps: AutomationStep[],
        context: StepContext
    ): Promise<{ results: StepResult[]; success: boolean }> {
        if (steps.length > MAX_STEPS_PER_RUN) {
            return {
                results: [{
                    stepId: 'blast-radius-check',
                    action: 'validation',
                    status: 'failed',
                    output: {},
                    durationMs: 0,
                    error: `Blueprint has ${steps.length} steps, exceeding the maximum of ${MAX_STEPS_PER_RUN}`
                }],
                success: false
            };
        }

        const results: StepResult[] = [];
        let success = true;

        for (const step of steps) {
            const result = await this.executeStep(step, context);
            results.push(result);

            if (result.status === 'failed') {
                success = false;
                // Stop execution on failure
                break;
            }
        }

        return { results, success };
    }

    /**
     * Dispatch a step to the appropriate write-back handler.
     * Each connector action is implemented as a handler method.
     */
    private async dispatch(
        step: AutomationStep,
        context: StepContext
    ): Promise<Record<string, unknown>> {
        const action = step.action.toLowerCase();

        switch (action) {
            // Slack actions
            case 'send_message':
                return this.slackSendMessage(step, context);

            // Gmail actions
            case 'send_draft':
                return this.gmailSendDraft(step, context);

            // Linear actions
            case 'create_issue':
                return this.linearCreateIssue(step, context);
            case 'update_status':
                return this.linearUpdateStatus(step, context);

            // Notion actions
            case 'create_page':
                return this.notionCreatePage(step, context);

            // GitHub actions
            case 'create_github_issue':
                return this.githubCreateIssue(step, context);
            case 'post_comment':
                return this.githubPostComment(step, context);

            // Jira actions
            case 'create_jira_issue':
                return this.jiraCreateIssue(step, context);

            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }

    // ── Write-back action handlers ──────────────────────────────────────────
    // These are stub implementations that validate parameters and return
    // simulated results. In production, they would call connector SDKs.

    private async slackSendMessage(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { channel, text } = step.parameters;
        if (!channel || !text) throw new Error('Slack send_message requires channel and text');

        this.logger.log(`Slack: Sending message to ${channel}`);
        return {
            provider: 'SLACK',
            channel,
            messageId: `msg-${Date.now()}`,
            delivered: true
        };
    }

    private async gmailSendDraft(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { to, subject, body } = step.parameters;
        if (!to || !subject) throw new Error('Gmail send_draft requires to and subject');

        this.logger.log(`Gmail: Creating draft to ${to}`);
        return {
            provider: 'GMAIL',
            draftId: `draft-${Date.now()}`,
            to,
            subject,
            status: 'draft_created'
        };
    }

    private async linearCreateIssue(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { title, teamId, priority } = step.parameters;
        if (!title || !teamId) throw new Error('Linear create_issue requires title and teamId');

        this.logger.log(`Linear: Creating issue "${title}" in team ${teamId}`);
        return {
            provider: 'LINEAR',
            issueId: `issue-${Date.now()}`,
            title,
            teamId,
            priority: priority ?? 3,
            status: 'created'
        };
    }

    private async linearUpdateStatus(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { issueId, status } = step.parameters;
        if (!issueId || !status) throw new Error('Linear update_status requires issueId and status');

        this.logger.log(`Linear: Updating issue ${issueId} → ${status}`);
        return {
            provider: 'LINEAR',
            issueId,
            previousStatus: 'unknown',
            newStatus: status,
            updated: true
        };
    }

    private async notionCreatePage(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { title, parentId } = step.parameters;
        if (!title) throw new Error('Notion create_page requires title');

        this.logger.log(`Notion: Creating page "${title}"`);
        return {
            provider: 'NOTION',
            pageId: `page-${Date.now()}`,
            title,
            parentId: parentId ?? 'workspace-root',
            status: 'created'
        };
    }

    private async githubCreateIssue(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { repo, title, body } = step.parameters;
        if (!repo || !title) throw new Error('GitHub create_issue requires repo and title');

        this.logger.log(`GitHub: Creating issue "${title}" in ${repo}`);
        return {
            provider: 'GITHUB',
            issueNumber: Math.floor(Math.random() * 1000) + 1,
            repo,
            title,
            body: body ?? '',
            status: 'created'
        };
    }

    private async githubPostComment(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { repo, issueNumber, body } = step.parameters;
        if (!repo || !issueNumber || !body) {
            throw new Error('GitHub post_comment requires repo, issueNumber, and body');
        }

        this.logger.log(`GitHub: Posting comment on ${repo}#${issueNumber}`);
        return {
            provider: 'GITHUB',
            commentId: `comment-${Date.now()}`,
            repo,
            issueNumber,
            status: 'posted'
        };
    }

    private async jiraCreateIssue(
        step: AutomationStep,
        _context: StepContext
    ): Promise<Record<string, unknown>> {
        const { projectKey, summary, issueType } = step.parameters;
        if (!projectKey || !summary) throw new Error('Jira create_issue requires projectKey and summary');

        this.logger.log(`Jira: Creating ${issueType ?? 'Task'} "${summary}" in ${projectKey}`);
        return {
            provider: 'JIRA',
            issueKey: `${projectKey}-${Math.floor(Math.random() * 1000) + 1}`,
            summary,
            issueType: issueType ?? 'Task',
            status: 'created'
        };
    }

    // ── Utility ─────────────────────────────────────────────────────────────

    private withTimeout<T>(
        promise: Promise<T>,
        ms: number,
        message: string
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(message)), ms);
            promise
                .then((value) => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }
}
