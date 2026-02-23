import { createHash } from 'crypto';

export function buildRawEventHash(input: {
  provider: string;
  externalId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}): string {
  const canonicalPayload = JSON.stringify(input.payload, Object.keys(input.payload).sort());
  const base = `${input.provider}|${input.externalId}|${input.occurredAt}|${canonicalPayload}`;
  return createHash('sha256').update(base).digest('hex');
}
