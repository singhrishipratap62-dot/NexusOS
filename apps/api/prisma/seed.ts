import { PipelineService } from '../src/pipeline/pipeline.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeasibilityService } from '../src/scoring/feasibility.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const pipeline = new PipelineService(prisma, new FeasibilityService());
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
