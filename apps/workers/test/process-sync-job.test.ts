import { describe, expect, it, vi } from 'vitest';
import { processSyncConnectorJob } from '../src/sync/process-sync-job';

describe('processSyncConnectorJob', () => {
  it('moves sync job status RUNNING -> SUCCEEDED and enqueues normalization', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const ingestProviderEvents = vi.fn().mockResolvedValue(undefined);
    const enqueueNormalizeEvents = vi.fn().mockResolvedValue(undefined);

    await processSyncConnectorJob(
      {
        tenantId: 'tenant_day1',
        connectorId: 'connector_1',
        syncJobId: 'job_1',
        provider: 'SLACK'
      },
      {
        prisma: {
          syncJob: {
            update
          }
        },
        ingestProviderEvents,
        enqueueNormalizeEvents
      }
    );

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0]?.data?.status).toBe('RUNNING');
    expect(update.mock.calls[1]?.[0]?.data?.status).toBe('SUCCEEDED');
    expect(ingestProviderEvents).toHaveBeenCalledWith('tenant_day1', 'SLACK');
    expect(enqueueNormalizeEvents).toHaveBeenCalledWith({
      tenantId: 'tenant_day1',
      provider: 'SLACK'
    });
  });

  it('moves sync job status RUNNING -> FAILED on ingestion error', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const ingestProviderEvents = vi.fn().mockRejectedValue(new Error('slack api failed'));
    const enqueueNormalizeEvents = vi.fn().mockResolvedValue(undefined);

    await expect(
      processSyncConnectorJob(
        {
          tenantId: 'tenant_day1',
          connectorId: 'connector_1',
          syncJobId: 'job_2',
          provider: 'SLACK'
        },
        {
          prisma: {
            syncJob: {
              update
            }
          },
          ingestProviderEvents,
          enqueueNormalizeEvents
        }
      )
    ).rejects.toThrowError('slack api failed');

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0]?.data?.status).toBe('RUNNING');
    expect(update.mock.calls[1]?.[0]?.data?.status).toBe('FAILED');
    expect(enqueueNormalizeEvents).not.toHaveBeenCalled();
  });
});
