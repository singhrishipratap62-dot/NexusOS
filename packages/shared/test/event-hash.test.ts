import { describe, expect, it } from 'vitest';
import { buildRawEventHash } from '../src/event-hash';

describe('buildRawEventHash', () => {
  it('returns same hash for same semantic payload regardless of key order', () => {
    const a = buildRawEventHash({
      provider: 'SLACK',
      externalId: 'C1:123',
      occurredAt: '2026-02-20T00:00:00.000Z',
      payload: { b: 2, a: 1 }
    });

    const b = buildRawEventHash({
      provider: 'SLACK',
      externalId: 'C1:123',
      occurredAt: '2026-02-20T00:00:00.000Z',
      payload: { a: 1, b: 2 }
    });

    expect(a).toBe(b);
  });

  it('changes hash when external id changes', () => {
    const a = buildRawEventHash({
      provider: 'SLACK',
      externalId: 'C1:123',
      occurredAt: '2026-02-20T00:00:00.000Z',
      payload: { a: 1 }
    });

    const b = buildRawEventHash({
      provider: 'SLACK',
      externalId: 'C1:124',
      occurredAt: '2026-02-20T00:00:00.000Z',
      payload: { a: 1 }
    });

    expect(a).not.toBe(b);
  });
});
