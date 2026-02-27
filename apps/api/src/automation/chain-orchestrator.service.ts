import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationService } from './automation.service';

interface ChainNode {
    blueprintId: string;
    triggerCondition: string; // e.g. "output_from_previous", "always"
    position: number;
    label?: string;
}

interface NodeResult {
    blueprintId: string;
    runId: string | null;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
    output: any;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
}

@Injectable()
export class ChainOrchestratorService {
    private readonly logger = new Logger(ChainOrchestratorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly automationService: AutomationService
    ) { }

    // ─── CRUD ──────────────────────────────────────

    async createChain(tenantId: string, data: {
        name: string;
        description?: string;
        nodes: ChainNode[];
        createdById: string;
    }) {
        return this.prisma.agentChain.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description ?? null,
                nodes: data.nodes as any,
                createdById: data.createdById,
                status: 'DRAFT'
            }
        });
    }

    async listChains(tenantId: string) {
        const chains = await this.prisma.agentChain.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: { runs: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });

        // Enrich with agent names
        const blueprintIds = new Set<string>();
        for (const chain of chains) {
            for (const node of (chain.nodes as any[]) ?? []) {
                if (node.blueprintId) blueprintIds.add(node.blueprintId);
            }
        }

        const blueprints = await this.prisma.automationBlueprint.findMany({
            where: { id: { in: [...blueprintIds] } },
            select: { id: true, name: true, status: true }
        });
        const bpMap = new Map(blueprints.map(b => [b.id, b]));

        return chains.map(chain => ({
            ...chain,
            nodeDetails: ((chain.nodes as any[]) ?? []).map((n: ChainNode) => ({
                ...n,
                agentName: bpMap.get(n.blueprintId)?.name ?? 'Unknown',
                agentStatus: bpMap.get(n.blueprintId)?.status ?? 'UNKNOWN'
            })),
            lastRun: chain.runs[0] ?? null,
            totalRuns: chain.runs.length
        }));
    }

    async getChain(tenantId: string, chainId: string) {
        const chain = await this.prisma.agentChain.findUnique({
            where: { id: chainId },
            include: {
                runs: { orderBy: { createdAt: 'desc' }, take: 20 }
            }
        });
        if (!chain || chain.tenantId !== tenantId) {
            throw new NotFoundException('Chain not found');
        }

        const nodes = (chain.nodes as any[]) ?? [];
        const blueprintIds = nodes.map((n: ChainNode) => n.blueprintId);
        const blueprints = await this.prisma.automationBlueprint.findMany({
            where: { id: { in: blueprintIds } },
            select: { id: true, name: true, status: true, persona: true }
        });
        const bpMap = new Map(blueprints.map(b => [b.id, b]));

        return {
            ...chain,
            nodeDetails: nodes.map((n: ChainNode) => ({
                ...n,
                agentName: bpMap.get(n.blueprintId)?.name ?? 'Unknown',
                agentStatus: bpMap.get(n.blueprintId)?.status ?? 'UNKNOWN',
                persona: bpMap.get(n.blueprintId)?.persona ?? null
            })),
            metrics: await this.getChainMetrics(tenantId, chainId)
        };
    }

    async updateChain(tenantId: string, chainId: string, data: Partial<{ name: string; description: string; status: string; nodes: ChainNode[] }>) {
        const chain = await this.prisma.agentChain.findUnique({ where: { id: chainId } });
        if (!chain || chain.tenantId !== tenantId) throw new NotFoundException('Chain not found');

        return this.prisma.agentChain.update({
            where: { id: chainId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.status !== undefined && { status: data.status as any }),
                ...(data.nodes !== undefined && { nodes: data.nodes as any })
            }
        });
    }

    // ─── EXECUTION ─────────────────────────────────

    async executeChain(tenantId: string, chainId: string, inputContext?: any): Promise<any> {
        const chain = await this.prisma.agentChain.findUnique({ where: { id: chainId } });
        if (!chain || chain.tenantId !== tenantId) throw new NotFoundException('Chain not found');

        const nodes = (chain.nodes as unknown as ChainNode[]) ?? [];
        if (nodes.length === 0) throw new BadRequestException('Chain has no nodes');

        // Create chain run
        const chainRun = await this.prisma.agentChainRun.create({
            data: {
                tenantId,
                chainId,
                status: 'RUNNING',
                inputContext: inputContext ?? null,
                nodeResults: nodes.map(n => ({
                    blueprintId: n.blueprintId,
                    runId: null,
                    status: 'pending',
                    output: null,
                    startedAt: null,
                    finishedAt: null,
                    error: null
                })),
                startedAt: new Date()
            }
        });

        this.logger.log(`Starting chain run ${chainRun.id} for chain "${chain.name}" (${nodes.length} nodes)`);

        return this.executeChainNodes(tenantId, chainRun.id, nodes, 0, inputContext);
    }

    /**
     * Retry a failed chain run from the point of failure.
     */
    async retryChainFromFailure(tenantId: string, chainRunId: string): Promise<any> {
        const chainRun = await this.prisma.agentChainRun.findUnique({ where: { id: chainRunId } });
        if (!chainRun || chainRun.tenantId !== tenantId) throw new NotFoundException('Chain run not found');
        if (chainRun.status !== 'FAILED') throw new BadRequestException('Can only retry failed chain runs');
        if (chainRun.failedAtNode == null) throw new BadRequestException('No failure point recorded');

        const chain = await this.prisma.agentChain.findUnique({ where: { id: chainRun.chainId } });
        if (!chain) throw new NotFoundException('Chain not found');

        const nodes = (chain.nodes as unknown as ChainNode[]) ?? [];
        const nodeResults = (chainRun.nodeResults as unknown as NodeResult[]) ?? [];

        // Collect output from the last successful node as input context
        let inputContext = chainRun.inputContext;
        if (chainRun.failedAtNode > 0) {
            const lastSuccessfulResult = nodeResults[chainRun.failedAtNode - 1];
            if (lastSuccessfulResult?.output) {
                inputContext = lastSuccessfulResult.output;
            }
        }

        // Reset the run to RUNNING
        await this.prisma.agentChainRun.update({
            where: { id: chainRunId },
            data: {
                status: 'RUNNING',
                retryFromNode: chainRun.failedAtNode,
                error: null
            }
        });

        this.logger.log(`Retrying chain run ${chainRunId} from node ${chainRun.failedAtNode}`);

        return this.executeChainNodes(tenantId, chainRunId, nodes, chainRun.failedAtNode, inputContext);
    }

    /**
     * Core execution loop: run nodes sequentially, passing context.
     */
    private async executeChainNodes(
        tenantId: string,
        chainRunId: string,
        nodes: ChainNode[],
        startFromNode: number,
        inputContext: any
    ): Promise<any> {
        let currentContext = inputContext;
        const nodeResults: NodeResult[] = [];

        // Preserve results from previous successful nodes (for retry)
        const existingRun = await this.prisma.agentChainRun.findUnique({ where: { id: chainRunId } });
        const existingResults = (existingRun?.nodeResults as unknown as NodeResult[]) ?? [];
        for (let i = 0; i < startFromNode; i++) {
            nodeResults.push(existingResults[i] ?? {
                blueprintId: nodes[i].blueprintId,
                runId: null, status: 'succeeded', output: null,
                startedAt: null, finishedAt: null, error: null
            });
        }

        for (let i = startFromNode; i < nodes.length; i++) {
            const node = nodes[i];
            const nodeStart = new Date();

            this.logger.log(`Chain run ${chainRunId}: executing node ${i} (blueprint ${node.blueprintId})`);

            // Update node status to running
            const runningResults = [...nodeResults];
            for (let j = i; j < nodes.length; j++) {
                runningResults.push({
                    blueprintId: nodes[j].blueprintId,
                    runId: null,
                    status: j === i ? 'running' : 'pending',
                    output: null, startedAt: j === i ? nodeStart.toISOString() : null,
                    finishedAt: null, error: null
                });
            }
            await this.prisma.agentChainRun.update({
                where: { id: chainRunId },
                data: { nodeResults: runningResults as any }
            });

            try {
                // Create and execute the agent run with input context
                const run = await this.automationService.createRun(tenantId, node.blueprintId, 'chain_orchestrator');

                // Inject input context into the run (store as metadata)
                if (currentContext) {
                    await this.prisma.automationRun.update({
                        where: { id: run.id },
                        data: { logs: [{ type: 'chain_input', context: currentContext }] as any }
                    });
                }

                const executedRun = await this.automationService.executeRun(tenantId, run.id);

                if (executedRun.status === 'SUCCEEDED') {
                    // Extract output from step results
                    const stepResults = (executedRun.stepResults as any[]) ?? [];
                    const output = {
                        runId: executedRun.id,
                        blueprintId: node.blueprintId,
                        stepResults: stepResults.map(s => ({
                            stepId: s.stepId, action: s.action, status: s.status, output: s.output
                        })),
                        chainContext: currentContext
                    };

                    nodeResults.push({
                        blueprintId: node.blueprintId,
                        runId: executedRun.id,
                        status: 'succeeded',
                        output,
                        startedAt: nodeStart.toISOString(),
                        finishedAt: new Date().toISOString(),
                        error: null
                    });

                    // Pass output to next node
                    currentContext = output;

                    this.logger.log(`Chain run ${chainRunId}: node ${i} succeeded`);
                } else if (executedRun.status === 'WAITING_HITL') {
                    // HITL pause — mark node as running, the chain waits
                    nodeResults.push({
                        blueprintId: node.blueprintId,
                        runId: executedRun.id,
                        status: 'running',
                        output: null,
                        startedAt: nodeStart.toISOString(),
                        finishedAt: null,
                        error: 'Waiting for human approval'
                    });

                    // Mark remaining nodes as pending
                    for (let j = i + 1; j < nodes.length; j++) {
                        nodeResults.push({
                            blueprintId: nodes[j].blueprintId,
                            runId: null, status: 'pending', output: null,
                            startedAt: null, finishedAt: null, error: null
                        });
                    }

                    await this.prisma.agentChainRun.update({
                        where: { id: chainRunId },
                        data: { nodeResults: nodeResults as any, status: 'RUNNING' }
                    });

                    return this.prisma.agentChainRun.findUnique({ where: { id: chainRunId } });
                } else {
                    // Run failed
                    throw new Error(`Agent run ${executedRun.id} finished with status: ${executedRun.status}`);
                }
            } catch (err: any) {
                this.logger.error(`Chain run ${chainRunId}: node ${i} failed: ${err.message}`);

                nodeResults.push({
                    blueprintId: node.blueprintId,
                    runId: null,
                    status: 'failed',
                    output: null,
                    startedAt: nodeStart.toISOString(),
                    finishedAt: new Date().toISOString(),
                    error: err.message
                });

                // Mark remaining nodes as skipped
                for (let j = i + 1; j < nodes.length; j++) {
                    nodeResults.push({
                        blueprintId: nodes[j].blueprintId,
                        runId: null, status: 'skipped', output: null,
                        startedAt: null, finishedAt: null, error: null
                    });
                }

                // Count consecutive failures
                const prevRuns = await this.prisma.agentChainRun.findMany({
                    where: { chainId: existingRun!.chainId, status: 'FAILED' },
                    orderBy: { createdAt: 'desc' },
                    take: 3
                });
                const consecutiveFailures = prevRuns.length + 1;

                await this.prisma.agentChainRun.update({
                    where: { id: chainRunId },
                    data: {
                        status: 'FAILED',
                        nodeResults: nodeResults as any,
                        failedAtNode: i,
                        consecutiveFailures,
                        finishedAt: new Date(),
                        error: `Node ${i} failed: ${err.message}`
                    }
                });

                // Alert if 3+ consecutive failures
                if (consecutiveFailures >= 3) {
                    this.logger.warn(`ALERT: Chain "${existingRun!.chainId}" has failed ${consecutiveFailures} times consecutively!`);
                    // In production: send Slack/email alert here
                }

                return this.prisma.agentChainRun.findUnique({ where: { id: chainRunId } });
            }
        }

        // All nodes succeeded
        await this.prisma.agentChainRun.update({
            where: { id: chainRunId },
            data: {
                status: 'SUCCEEDED',
                nodeResults: nodeResults as any,
                finishedAt: new Date(),
                consecutiveFailures: 0
            }
        });

        this.logger.log(`Chain run ${chainRunId}: completed successfully (${nodes.length} nodes)`);

        return this.prisma.agentChainRun.findUnique({ where: { id: chainRunId } });
    }

    // ─── METRICS ───────────────────────────────────

    async getChainMetrics(tenantId: string, chainId: string) {
        const runs = await this.prisma.agentChainRun.findMany({
            where: { tenantId, chainId },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        const succeeded = runs.filter(r => r.status === 'SUCCEEDED');
        const failed = runs.filter(r => r.status === 'FAILED');

        // Average end-to-end duration
        const durations = succeeded
            .filter(r => r.startedAt && r.finishedAt)
            .map(r => new Date(r.finishedAt!).getTime() - new Date(r.startedAt!).getTime());
        const avgDurationMs = durations.length > 0
            ? durations.reduce((s, d) => s + d, 0) / durations.length
            : 0;

        // Get chain node count from chain definition
        const chain = await this.prisma.agentChain.findUnique({ where: { id: chainId } });
        const nodeCount = chain ? ((chain.nodes as any[]) ?? []).length : 0;

        return {
            totalRuns: runs.length,
            succeededRuns: succeeded.length,
            failedRuns: failed.length,
            successRate: runs.length > 0 ? Math.round((succeeded.length / runs.length) * 100) : 0,
            avgDurationMs: Math.round(avgDurationMs),
            avgDurationSeconds: Math.round(avgDurationMs / 1000),
            nodeCount,
            lastRun: runs[0] ?? null
        };
    }

    async getChainRuns(tenantId: string, chainId: string) {
        return this.prisma.agentChainRun.findMany({
            where: { tenantId, chainId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
    }
}
