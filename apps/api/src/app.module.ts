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
import { StepExecutorService } from './automation/step-executor.service';
import { AgentReasoningService } from './automation/agent-reasoning.service';
import { TriggerEvaluatorService } from './automation/trigger-evaluator.service';
import { AgentMemoryService } from './automation/agent-memory.service';
import { AgentsController } from './automation/agents.controller';
import { ChainController } from './automation/chain.controller';
import { ChainOrchestratorService } from './automation/chain-orchestrator.service';
import { AiAnalysisController } from './ai/ai-analysis.controller';
import { AiController } from './ai/ai.controller';
import { BlueprintGeneratorService } from './ai/blueprint-generator.service';
import { OutcomeTrackerService } from './ai/outcome-tracker.service';
import { LlmService } from './ai/llm.service';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { SanitizeInterceptor } from './common/sanitize.interceptor';
import { AiModule } from './ai/ai.module';
import { DemoController } from './demo/demo.controller';
import { DemoService } from './demo/demo.service';

@Module({
  imports: [AiModule],
  controllers: [
    HealthController,
    AuthController,
    ConnectorsController,
    PipelineController,
    TenantsController,
    WarRoomController,
    ReviewController,
    AutomationController,
    AgentsController,
    AiAnalysisController,
    AiController,
    ChainController,
    DemoController
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
      useFactory: (prisma: PrismaService, feasibility: FeasibilityService, triggerEvaluator: TriggerEvaluatorService) =>
        new PipelineService(prisma, feasibility, triggerEvaluator),
      inject: [PrismaService, FeasibilityService, TriggerEvaluatorService]
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
    StepExecutorService,
    {
      provide: AgentMemoryService,
      useFactory: (prisma: PrismaService, llm: LlmService) => new AgentMemoryService(prisma, llm),
      inject: [PrismaService, LlmService]
    },
    {
      provide: AgentReasoningService,
      useFactory: (llm: LlmService, agentMemory: AgentMemoryService) => new AgentReasoningService(llm, agentMemory),
      inject: [LlmService, AgentMemoryService]
    },
    {
      provide: TriggerEvaluatorService,
      useFactory: (prisma: PrismaService) => new TriggerEvaluatorService(prisma),
      inject: [PrismaService]
    },
    {
      provide: OutcomeTrackerService,
      useFactory: (prisma: PrismaService) => new OutcomeTrackerService(prisma),
      inject: [PrismaService]
    },
    {
      provide: BlueprintGeneratorService,
      useFactory: (prisma: PrismaService, llm: LlmService) =>
        new BlueprintGeneratorService(prisma, llm),
      inject: [PrismaService, LlmService]
    },
    {
      provide: AutomationService,
      useFactory: (prisma: PrismaService, stepExecutor: StepExecutorService, outcomeTracker: OutcomeTrackerService, agentReasoning: AgentReasoningService, agentMemory: AgentMemoryService) =>
        new AutomationService(prisma, stepExecutor, outcomeTracker, agentReasoning, agentMemory),
      inject: [PrismaService, StepExecutorService, OutcomeTrackerService, AgentReasoningService, AgentMemoryService]
    },
    {
      provide: ChainOrchestratorService,
      useFactory: (prisma: PrismaService, automationService: AutomationService) =>
        new ChainOrchestratorService(prisma, automationService),
      inject: [PrismaService, AutomationService]
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
    },
    {
      provide: DemoService,
      useFactory: (prisma: PrismaService, jwtTokenService: JwtTokenService) => new DemoService(prisma, jwtTokenService),
      inject: [PrismaService, JwtTokenService]
    },
    // Global input sanitization
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestLoggerMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}
