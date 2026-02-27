import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryType, Prisma } from '@prisma/client';
import { LlmService } from '../ai/llm.service';

@Injectable()
export class AgentMemoryService {
    private readonly logger = new Logger(AgentMemoryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly llm: LlmService
    ) { }

    /**
     * Store an episodic memory (e.g., a log of a specific action taken).
     */
    async addEpisodicMemory(tenantId: string, blueprintId: string, content: string, context?: Record<string, any>) {
        return this.prisma.agentMemory.create({
            data: {
                tenantId,
                blueprintId,
                type: 'EPISODIC',
                content,
                ...(context ? { context: context as unknown as Prisma.InputJsonValue } : {})
            }
        });
    }

    /**
     * Store working memory (context for the current run).
     */
    async addWorkingMemory(tenantId: string, blueprintId: string, content: string) {
        return this.prisma.agentMemory.create({
            data: {
                tenantId,
                blueprintId,
                type: 'WORKING',
                content
            }
        });
    }

    /**
     * Clear working memory (called after a run finishes).
     */
    async clearWorkingMemory(tenantId: string, blueprintId: string) {
        return this.prisma.agentMemory.deleteMany({
            where: {
                tenantId,
                blueprintId,
                type: 'WORKING'
            }
        });
    }

    /**
     * Store a semantic memory (extracted fact).
     */
    async addSemanticMemory(tenantId: string, blueprintId: string, content: string) {
        return this.prisma.agentMemory.create({
            data: {
                tenantId,
                blueprintId,
                type: 'SEMANTIC',
                content
            }
        });
    }

    /**
     * Get memories for an agent to inject into the LLM context.
     */
    async getRelevantMemories(tenantId: string, blueprintId: string) {
        const [semantic, episodic, working] = await Promise.all([
            // Get all semantic memories (facts/rules)
            this.prisma.agentMemory.findMany({
                where: { tenantId, blueprintId, type: 'SEMANTIC' },
                orderBy: { createdAt: 'desc' }
            }),
            // Get recent episodic memories (last 20 actions)
            this.prisma.agentMemory.findMany({
                where: { tenantId, blueprintId, type: 'EPISODIC' },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            // Get current working memory
            this.prisma.agentMemory.findMany({
                where: { tenantId, blueprintId, type: 'WORKING' },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        return {
            semantic: semantic.map((m: any) => m.content),
            episodic: episodic.reverse().map((m: any) => `[${m.createdAt.toISOString()}] ${m.content}`),
            working: working.map((m: any) => m.content)
        };
    }

    /**
     * Post-run: Extract new semantic facts from the run logs/results.
     * Takes the recent run data and asks the LLM to extract any reusable facts.
     */
    async extractSemanticFacts(tenantId: string, blueprintId: string, runLogs: string[]) {
        if (!this.llm.isAvailable || runLogs.length === 0) return;

        const systemPrompt = `You are an agent memory extractor. Review the provided run logs from an automation agent.
Extract any NEW, persistent semantic facts about the environment, user preferences, or workflow behaviors that would be useful for future runs.
Return a JSON object with a "facts" array of strings. Only return facts, not transient event data. Try to be concise.
If no new persistent facts are identified, return an empty array.`;

        const userPrompt = `RUN LOGS:\n${runLogs.join('\n')}`;

        try {
            const { data } = await this.llm.completeJSON<{ facts: string[] }>({
                systemPrompt,
                userPrompt,
                fallback: { facts: [] }
            });

            if (data.facts && data.facts.length > 0) {
                for (const fact of data.facts) {
                    await this.addSemanticMemory(tenantId, blueprintId, fact);
                    this.logger.log(`[AgentMemory] Extracted new semantic fact for ${blueprintId}: "${fact}"`);
                }
            }
        } catch (err: any) {
            this.logger.warn(`Failed to extract semantic facts: ${err.message}`);
        }
    }
}
