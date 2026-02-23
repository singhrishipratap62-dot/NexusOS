import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  AutomationRunJobPayload,
  ExtractAndScoreJobPayload,
  QUEUE_NAMES,
  SyncConnectorJobPayload
} from '@nexus/shared';

@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly connection: any = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true
  });
  private readonly ingestionQueue = new Queue(QUEUE_NAMES.ingestion, {
    connection: this.connection as never
  });
  private readonly workflowQueue = new Queue(QUEUE_NAMES.workflow, {
    connection: this.connection as never
  });
  private readonly automationQueue = new Queue(QUEUE_NAMES.automation, {
    connection: this.connection as never
  });
  private connected = false;

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      await this.connection.connect();
      this.connected = true;
    } catch (error) {
      this.logger.warn(`Redis unavailable, queueing disabled: ${(error as Error).message}`);
      throw error;
    }
  }

  async enqueueConnectorSync(payload: SyncConnectorJobPayload): Promise<string> {
    await this.ensureConnected();
    const job = await this.ingestionQueue.add('sync-connector', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 200
    });

    return job.id?.toString() ?? 'unknown';
  }

  async enqueueExtractAndScore(payload: ExtractAndScoreJobPayload): Promise<string> {
    await this.ensureConnected();
    const job = await this.workflowQueue.add('extract-and-score', payload, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 200
    });

    return job.id?.toString() ?? 'unknown';
  }

  async enqueueAutomationRun(payload: AutomationRunJobPayload): Promise<string> {
    await this.ensureConnected();
    const job = await this.automationQueue.add('run-blueprint', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 200
    });

    return job.id?.toString() ?? 'unknown';
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.ingestionQueue.close(),
      this.workflowQueue.close(),
      this.automationQueue.close(),
      this.connection.quit()
    ]);
  }
}
