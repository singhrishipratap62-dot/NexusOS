import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationBlueprint, AutomationRun, BlueprintStatus, TriggerType } from '@nexus/contracts';
import { Prisma } from '@prisma/client';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createBlueprint(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      workflowId?: string;
      triggerType: TriggerType;
      triggerConfig?: Record<string, any>;
      steps: any[];
      dryRun?: boolean;
      createdById: string;
    }
  ): Promise<AutomationBlueprint> {
    if (data.triggerType === 'SCHEDULED' && !data.triggerConfig?.cron) {
      throw new BadRequestException('Scheduled triggers require a cron expression.');
    }

    const blueprint = await this.prisma.automationBlueprint.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        workflowId: data.workflowId,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig as Prisma.InputJsonValue,
        steps: data.steps as Prisma.InputJsonValue,
        dryRun: data.dryRun ?? true,
        createdById: data.createdById,
        status: 'DRAFT'
      }
    });

    return blueprint as unknown as AutomationBlueprint;
  }

  async getBlueprint(tenantId: string, blueprintId: string): Promise<AutomationBlueprint> {
    const blueprint = await this.prisma.automationBlueprint.findUnique({
      where: { id: blueprintId, tenantId }
    });
    if (!blueprint) {
      throw new NotFoundException(`Blueprint with ID ${blueprintId} not found`);
    }
    return blueprint as unknown as AutomationBlueprint;
  }

  async listBlueprints(tenantId: string): Promise<AutomationBlueprint[]> {
    const blueprints = await this.prisma.automationBlueprint.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
    return blueprints as unknown as AutomationBlueprint[];
  }

  async updateBlueprint(
    tenantId: string,
    blueprintId: string,
    data: Partial<Omit<AutomationBlueprint, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<AutomationBlueprint> {
    await this.getBlueprint(tenantId, blueprintId);

    const updateData: any = { ...data };
    if (data.steps) updateData.steps = data.steps as Prisma.InputJsonValue;
    if (data.triggerConfig) updateData.triggerConfig = data.triggerConfig as Prisma.InputJsonValue;

    const updated = await this.prisma.automationBlueprint.update({
      where: { id: blueprintId },
      data: updateData
    });

    return updated as unknown as AutomationBlueprint;
  }

  async deleteBlueprint(tenantId: string, blueprintId: string): Promise<void> {
    await this.getBlueprint(tenantId, blueprintId);
    await this.prisma.automationBlueprint.delete({
      where: { id: blueprintId }
    });
  }

  async createRun(tenantId: string, blueprintId: string, triggeredBy: string): Promise<AutomationRun> {
    const blueprint = await this.getBlueprint(tenantId, blueprintId);

    const run = await this.prisma.automationRun.create({
      data: {
        tenantId,
        blueprintId,
        triggeredBy,
        dryRun: blueprint.dryRun,
        status: 'QUEUED'
      }
    });

    return run as unknown as AutomationRun;
  }

  async listRuns(tenantId: string, blueprintId?: string): Promise<AutomationRun[]> {
    const where: Prisma.AutomationRunWhereInput = { tenantId };
    if (blueprintId) {
      where.blueprintId = blueprintId;
    }

    const runs = await this.prisma.automationRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return runs as unknown as AutomationRun[];
  }

  async getRun(tenantId: string, runId: string): Promise<AutomationRun> {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId, tenantId }
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${runId} not found`);
    }

    return run as unknown as AutomationRun;
  }
}
