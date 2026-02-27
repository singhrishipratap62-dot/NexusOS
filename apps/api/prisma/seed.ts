import { PipelineService } from '../src/pipeline/pipeline.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeasibilityService } from '../src/scoring/feasibility.service';
import { TriggerEvaluatorService } from '../src/automation/trigger-evaluator.service';
import { ChainOrchestratorService } from '../src/automation/chain-orchestrator.service';
import { AgentReasoningService } from '../src/automation/agent-reasoning.service';
import { AgentMemoryService } from '../src/automation/agent-memory.service';
import { StepExecutorService } from '../src/automation/step-executor.service';
import { LlmService } from '../src/ai/llm.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const llmService = new LlmService();
  const stepExecutor = new StepExecutorService(prisma, llmService);
  const triggerEvaluator = new TriggerEvaluatorService(prisma, stepExecutor);
  const pipeline = new PipelineService(prisma, new FeasibilityService(), triggerEvaluator);
  const tenantId = process.env.SINGLE_TENANT_ID ?? 'tenant_day1';

  const result = await pipeline.runSeededAudit(tenantId);
  // eslint-disable-next-line no-console
  console.log('Seed complete', JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
