import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PipelineService } from './pipeline/pipeline.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly pipelineService: PipelineService) {}

  async onModuleInit(): Promise<void> {
    const tenantId = process.env.SINGLE_TENANT_ID ?? 'tenant_day1';
    try {
      await this.pipelineService.ensureTenant(tenantId);
      await this.pipelineService.ensureConnector(tenantId, 'SLACK');
      await this.pipelineService.ensureConnector(tenantId, 'GMAIL');
    } catch (error) {
      this.logger.warn(
        `Bootstrap tenant seeding skipped because database is unavailable: ${(error as Error).message}`
      );
    }
  }
}
