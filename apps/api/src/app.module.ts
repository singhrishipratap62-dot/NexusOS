import {
  MiddlewareConsumer,
  Module,
  NestModule
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt.guard';
import { JwtTokenService } from './auth/jwt-token.service';
import { RolesGuard } from './auth/roles.guard';
import { ConnectorsController } from './connectors/connectors.controller';
import { ConnectorsService } from './connectors/connectors.service';
import { HealthController } from './health.controller';
import { JobQueueService } from './jobs/job-queue.service';
import { PipelineController } from './pipeline/pipeline.controller';
import { PipelineService } from './pipeline/pipeline.service';
import { PrismaService } from './prisma/prisma.service';
import { ReviewController } from './review/review.controller';
import { ReviewService } from './review/review.service';
import { FeasibilityService } from './scoring/feasibility.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { WarRoomController } from './war-room/war-room.controller';
import { WarRoomService } from './war-room/war-room.service';
import { BootstrapService } from './bootstrap.service';
import { AutomationController } from './automation/automation.controller';
import { AutomationService } from './automation/automation.service';

@Module({
  imports: [],
  controllers: [
    HealthController,
    AuthController,
    ConnectorsController,
    PipelineController,
    TenantsController,
    WarRoomController,
    ReviewController,
    AutomationController
  ],
  providers: [
    // Explicit useFactory on every provider so NestJS DI resolves correctly
    // regardless of whether the TypeScript transpiler emits decorator metadata.
    {
      provide: PrismaService,
      useFactory: () => new PrismaService()
    },
    {
      provide: FeasibilityService,
      useFactory: () => new FeasibilityService()
    },
    {
      provide: JobQueueService,
      useFactory: () => new JobQueueService()
    },
    {
      provide: JwtTokenService,
      useFactory: (prisma: PrismaService) => new JwtTokenService(prisma),
      inject: [PrismaService]
    },
    {
      provide: AuthService,
      useFactory: (prisma: PrismaService, jwtTokenService: JwtTokenService) =>
        new AuthService(prisma, jwtTokenService),
      inject: [PrismaService, JwtTokenService]
    },
    {
      provide: AuditService,
      useFactory: (prisma: PrismaService) => new AuditService(prisma),
      inject: [PrismaService]
    },
    {
      provide: PipelineService,
      useFactory: (prisma: PrismaService, feasibility: FeasibilityService) =>
        new PipelineService(prisma, feasibility),
      inject: [PrismaService, FeasibilityService]
    },
    {
      provide: ConnectorsService,
      useFactory: (prisma: PrismaService, pipeline: PipelineService, queue: JobQueueService) =>
        new ConnectorsService(prisma, pipeline, queue),
      inject: [PrismaService, PipelineService, JobQueueService]
    },
    {
      provide: WarRoomService,
      useFactory: (prisma: PrismaService) => new WarRoomService(prisma),
      inject: [PrismaService]
    },
    {
      provide: ReviewService,
      useFactory: (prisma: PrismaService) => new ReviewService(prisma),
      inject: [PrismaService]
    },
    {
      provide: TenantsService,
      useFactory: (prisma: PrismaService) => new TenantsService(prisma),
      inject: [PrismaService]
    },
    {
      provide: BootstrapService,
      useFactory: (pipeline: PipelineService) => new BootstrapService(pipeline),
      inject: [PipelineService]
    },
    {
      provide: AutomationService,
      useFactory: (prisma: PrismaService) => new AutomationService(prisma),
      inject: [PrismaService]
    },
    // Global JWT guard — all routes require auth unless decorated @Public()
    {
      provide: APP_GUARD,
      useFactory: (jwtTokenService: JwtTokenService, reflector: Reflector) =>
        new JwtAuthGuard(jwtTokenService, reflector),
      inject: [JwtTokenService, Reflector]
    },
    // Global roles guard — enforces @Roles() decorator
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector]
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (auditService: AuditService) => new AuditInterceptor(auditService),
      inject: [AuditService]
    }
  ]
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Auth is now handled by JwtAuthGuard (APP_GUARD) globally.
    // Tenant context is extracted from JWT claims in the guard.
  }
}
