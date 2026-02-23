import { Provider } from '@prisma/client';
import { SyncConnectorJobPayload } from '@nexus/shared';

interface SyncJobWriter {
  update(args: {
    where: { id: string };
    data: {
      status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
      startedAt?: Date;
      finishedAt?: Date;
      error?: string | null;
    };
  }): Promise<unknown>;
}

export interface SyncJobLifecycleDeps {
  prisma: {
    syncJob: SyncJobWriter;
  };
  ingestProviderEvents: (tenantId: string, provider: Provider) => Promise<unknown>;
  enqueueNormalizeEvents: (payload: { tenantId: string; provider: Provider }) => Promise<unknown>;
}

export async function processSyncConnectorJob(
  payload: SyncConnectorJobPayload,
  deps: SyncJobLifecycleDeps
): Promise<void> {
  await deps.prisma.syncJob.update({
    where: {
      id: payload.syncJobId
    },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      error: null
    }
  });

  try {
    await deps.ingestProviderEvents(payload.tenantId, payload.provider);
    await deps.enqueueNormalizeEvents({
      tenantId: payload.tenantId,
      provider: payload.provider
    });

    await deps.prisma.syncJob.update({
      where: {
        id: payload.syncJobId
      },
      data: {
        status: 'SUCCEEDED',
        finishedAt: new Date(),
        error: null
      }
    });
  } catch (error) {
    await deps.prisma.syncJob.update({
      where: {
        id: payload.syncJobId
      },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: (error as Error).message
      }
    });

    throw error;
  }
}
