import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtTokenService } from '../auth/jwt-token.service';
import { randomBytes } from 'crypto';

@Injectable()
export class DemoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtTokenService
    ) { }

    async createDemoTenant() {
        const suffix = randomBytes(3).toString('hex');
        const email = `demo_${suffix}@nexusos.com`;
        const tenantSlug = `demo-inc-${suffix}`;

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email,
                name: 'Demo User',
                passwordHash: 'dummy_hash', // Can't login normally anyway
            }
        });

        // Create demo tenant
        const tenant = await this.prisma.tenant.create({
            data: {
                name: 'Acme Corp (Demo)',
                isDemo: true,
                members: {
                    create: [{ userId: user.id, role: 'ADMIN' }]
                }
            }
        });

        await this.seedWorkflows(tenant.id);
        await this.seedAgents(tenant.id, user.id);

        // Generate token
        const token = await this.jwtService.generateTokenPair(user.id, tenant.id, 'ADMIN');

        return {
            success: true,
            tenantId: tenant.id,
            user: { id: user.id, email: user.email, name: user.name },
            token: token.accessToken
        };
    }

    private async seedWorkflows(tenantId: string) {
        const w1 = await this.prisma.workflow.create({
            data: {
                tenantId,
                workflowKey: 'demo_triage_flow',
                name: 'Triage incoming customer bugs in Slack',
                confidence: 0.95,
                avgMinutesPerRun: 8,
                monthlyRuns: 450,
                eventCount30d: 900,
                nodes: {
                    create: [
                        { tenantId, tool: 'slack', action: 'message', sequence: 1, actor: 'Human', confidence: 0.9 },
                        { tenantId, tool: 'linear', action: 'create_issue', sequence: 2, actor: 'Human', confidence: 0.85 }
                    ]
                },
                aiAnalysis: { summary: 'Team spends significant time creating Linear issues from Slack reports manually.', inefficiency: 'High context switching', recommendations: ['Automate issue creation'] }
            }
        });

        await this.prisma.hlcEstimate.create({
            data: {
                workflowId: w1.id,
                tenantId,
                annualLaborCost: 45900
            }
        });

        await this.prisma.feasibilityScore.create({
            data: {
                workflowId: w1.id,
                tenantId,
                feasibilityScore: 0.88,
                confidence: 0.85,
                breakdown: { complexity: 0.3, risk: 0.2, systemAccess: 0.9 },
                rationale: { summary: 'Standard API pattern between Slack and Linear.' }
            }
        });

        await this.prisma.roiSimulation.create({
            data: {
                workflowId: w1.id,
                tenantId,
                annualLaborCost: 45900,
                annualNetSavings: 38000,
                automationCoverage: 0.85,
                roiScore: 9.2,
                paybackMonths: 0.5
            }
        });

        await this.prisma.reviewQueue.create({
            data: {
                tenantId,
                workflowId: w1.id,
                recommendationStatus: 'RECOMMENDED',
                reviewStatus: 'PENDING_REVIEW'
            }
        });

        // Workflow 2
        const w2 = await this.prisma.workflow.create({
            data: {
                tenantId,
                workflowKey: 'demo_jira_report',
                name: 'Weekly status report from Jira to Email',
                confidence: 0.88,
                avgMinutesPerRun: 15,
                monthlyRuns: 200,
                eventCount30d: 400,
                nodes: {
                    create: [
                        { tenantId, tool: 'jira', action: 'search_issues', sequence: 1, actor: 'Human', confidence: 0.9 },
                        { tenantId, tool: 'gmail', action: 'send_email', sequence: 2, actor: 'Human', confidence: 0.9 }
                    ]
                },
                aiAnalysis: { summary: 'Managers manually compile Jira tickets into emails every Friday.', recommendations: ['Schedule automated summary'] }
            }
        });

        await this.prisma.hlcEstimate.create({
            data: {
                workflowId: w2.id,
                tenantId,
                annualLaborCost: 45000
            }
        });

        await this.prisma.feasibilityScore.create({
            data: {
                workflowId: w2.id,
                tenantId,
                feasibilityScore: 0.95,
                confidence: 0.9,
                breakdown: { complexity: 0.2, risk: 0.1, systemAccess: 0.95 },
                rationale: { summary: 'Highly repetitive scheduled task.' }
            }
        });

        await this.prisma.roiSimulation.create({
            data: {
                workflowId: w2.id,
                tenantId,
                annualLaborCost: 45000,
                annualNetSavings: 42000,
                automationCoverage: 0.98,
                roiScore: 9.8,
                paybackMonths: 0.2
            }
        });

        await this.prisma.reviewQueue.create({
            data: {
                tenantId,
                workflowId: w2.id,
                recommendationStatus: 'RECOMMENDED',
                reviewStatus: 'PENDING_REVIEW'
            }
        });
    }

    private async seedAgents(tenantId: string, createdById: string) {
        const agent1 = await this.prisma.automationBlueprint.create({
            data: {
                tenantId,
                name: 'Customer Triage Assistant',
                description: 'Monitors incoming emails and auto-assigns tags.',
                status: 'ACTIVE',
                dryRun: false,
                triggerType: 'EVENT',
                triggerConfig: { event: 'email_received' },
                steps: [
                    { action: 'read_email', connectorId: 'gmail' },
                    { action: 'analyze_intent', connectorId: 'ai' }
                ],
                createdById
            }
        });

        const agent2 = await this.prisma.automationBlueprint.create({
            data: {
                tenantId,
                name: 'Support Ticket Creator',
                description: 'Creates Jira tickets based on structured input.',
                status: 'ACTIVE',
                dryRun: false,
                triggerType: 'EVENT',
                triggerConfig: { event: 'ticket_requested' },
                steps: [
                    { action: 'create_issue', connectorId: 'jira' }
                ],
                createdById
            }
        });

        // Seed agent metrics
        await this.prisma.outcomeMetric.createMany({
            data: [
                { tenantId, runId: 'fake_run_1', metricType: 'time_saved_minutes', currentValue: 300, baselineValue: 0, blueprintId: agent1.id },
                { tenantId, runId: 'fake_run_1', metricType: 'net_saving_usd', currentValue: 250, baselineValue: 0, blueprintId: agent1.id },
                { tenantId, runId: 'fake_run_1', metricType: 'success_rate', currentValue: 98, baselineValue: 0, blueprintId: agent1.id },

                { tenantId, runId: 'fake_run_2', metricType: 'time_saved_minutes', currentValue: 120, baselineValue: 0, blueprintId: agent2.id },
                { tenantId, runId: 'fake_run_2', metricType: 'net_saving_usd', currentValue: 100, baselineValue: 0, blueprintId: agent2.id },
                { tenantId, runId: 'fake_run_2', metricType: 'success_rate', currentValue: 95, baselineValue: 0, blueprintId: agent2.id }
            ]
        });

        // Create a chain
        await this.prisma.agentChain.create({
            data: {
                tenantId,
                name: 'End-to-End Intake & Ticketing',
                description: 'Takes incoming emails, analyzes them, and creates corresponding tickets.',
                status: 'ACTIVE',
                createdById,
                nodes: [
                    { blueprintId: agent1.id, position: 0, triggerCondition: 'on_success' },
                    { blueprintId: agent2.id, position: 1, triggerCondition: 'on_success' }
                ]
            }
        });
    }
}
