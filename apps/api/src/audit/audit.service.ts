import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    actorId: string;
    path: string;
    method: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorId: input.actorId,
          path: input.path,
          method: input.method,
          action: input.action,
          metadata: input.metadata as unknown as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to write audit event: ${(error as Error).message}`);
    }
  }
}
