import { describe, expect, it } from 'vitest';
import { FEASIBILITY_RATIONALE_JSON_SCHEMA, REVIEW_THRESHOLD } from '../src';

describe('contracts package', () => {
  it('pins the review threshold contract used by gating logic', () => {
    expect(REVIEW_THRESHOLD).toBe(0.7);
  });

  it('exposes strict feasibility rationale JSON schema contract', () => {
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.type).toBe('object');
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.required).toEqual([
      'version',
      'summary',
      'blockers',
      'assumptions',
      'confidence'
    ]);
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.properties.version).toEqual({
      type: 'string',
      const: '1'
    });
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.properties.summary).toMatchObject({
      type: 'string',
      minLength: 1
    });
    expect(FEASIBILITY_RATIONALE_JSON_SCHEMA.properties.confidence).toEqual({
      type: 'number',
      minimum: 0,
      maximum: 1
    });
  });
});
