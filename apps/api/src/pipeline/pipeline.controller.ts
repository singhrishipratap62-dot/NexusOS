import { Controller, Post, Req } from '@nestjs/common';
import { JobQueueService } from '../jobs/job-queue.service';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
    private readonly queueService: JobQueueService
  ) {}

  @Post('run-seeded')
  async runSeeded(@Req() request: TenantRequest): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.pipelineService.runSeededAudit(tenantContext.tenantId);
  }

  @Post('extract-and-score')
  async enqueueExtractAndScore(@Req() request: TenantRequest): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    try {
      const queueJobId = await this.queueService.enqueueExtractAndScore({
        tenantId: tenantContext.tenantId
      });

      return {
        queueJobId,
        mode: 'QUEUED'
      };
    } catch (_error) {
      const result = await this.pipelineService.extractAndScore(tenantContext.tenantId);
      return {
        mode: 'INLINE_FALLBACK',
        ...result
      };
    }
  }
}
