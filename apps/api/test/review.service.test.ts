import { describe, expect, it, vi } from 'vitest';
import { ReviewService } from '../src/review/review.service';

describe('ReviewService.decide', () => {
  it('approves a pending item with analyst reason', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      workflowId: 'workflow-1',
      workflow: {
        tenantId: 'tenant_day1'
      }
    });
    const update = vi.fn().mockResolvedValue({
      workflowId: 'workflow-1',
      recommendationStatus: 'RECOMMENDED',
      reviewStatus: 'APPROVED'
    });

    const service = new ReviewService({
      reviewQueue: {
        findUnique,
        update
      }
    } as never);

    const result = await service.decide({
      tenantId: 'tenant_day1',
      workflowId: 'workflow-1',
      actorId: 'analyst-1',
      decision: 'APPROVE',
      reason: 'Exception pattern is low and automation controls are acceptable.'
    });

    expect(result).toEqual({
      workflowId: 'workflow-1',
      recommendationStatus: 'RECOMMENDED',
      reviewStatus: 'APPROVED'
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        workflowId: 'workflow-1'
      },
      data: {
        recommendationStatus: 'RECOMMENDED',
        reviewStatus: 'APPROVED',
        reason: 'Exception pattern is low and automation controls are acceptable.',
        reviewerId: 'analyst-1',
        reviewedAt: expect.any(Date)
      }
    });
  });

  it('rejects a pending item with analyst reason', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      workflowId: 'workflow-2',
      workflow: {
        tenantId: 'tenant_day1'
      }
    });
    const update = vi.fn().mockResolvedValue({
      workflowId: 'workflow-2',
      recommendationStatus: 'NOT_RECOMMENDED',
      reviewStatus: 'REJECTED'
    });

    const service = new ReviewService({
      reviewQueue: {
        findUnique,
        update
      }
    } as never);

    const result = await service.decide({
      tenantId: 'tenant_day1',
      workflowId: 'workflow-2',
      actorId: 'analyst-2',
      decision: 'REJECT',
      reason: 'Process variance is too high for safe Day-1 automation.'
    });

    expect(result).toEqual({
      workflowId: 'workflow-2',
      recommendationStatus: 'NOT_RECOMMENDED',
      reviewStatus: 'REJECTED'
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        workflowId: 'workflow-2'
      },
      data: {
        recommendationStatus: 'NOT_RECOMMENDED',
        reviewStatus: 'REJECTED',
        reason: 'Process variance is too high for safe Day-1 automation.',
        reviewerId: 'analyst-2',
        reviewedAt: expect.any(Date)
      }
    });
  });

  it('rejects cross-tenant review decisions', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      workflowId: 'workflow-3',
      workflow: {
        tenantId: 'tenant_other'
      }
    });
    const update = vi.fn().mockResolvedValue(undefined);

    const service = new ReviewService({
      reviewQueue: {
        findUnique,
        update
      }
    } as never);

    await expect(
      service.decide({
        tenantId: 'tenant_day1',
        workflowId: 'workflow-3',
        actorId: 'analyst-3',
        decision: 'APPROVE',
        reason: 'Manual override'
      })
    ).rejects.toThrowError('Review queue item not found for tenant');

    expect(update).not.toHaveBeenCalled();
  });
});
