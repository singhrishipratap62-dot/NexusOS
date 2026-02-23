# NexusOS Eval Fixtures

Test fixtures for the NexusOS audit pipeline. All files are **JSONL** (one JSON object per line). Machine-readable by Vitest or any JSON stream parser.

## Files

| File | Purpose | Count |
|------|---------|-------|
| `workflows.fixtures.jsonl` | Workflow DAG extraction test cases | 6 |
| `feasibility.fixtures.jsonl` | Feasibility scoring + HLC/ROI labeled cases | 8 |
| `adversarial.corpus.jsonl` | Prompt-injection and adversarial inputs | 10 |

---

## Fixture Schema

### `workflows.fixtures.jsonl`

Each record tests `WorkflowExtractionResult` output against labeled expected ranges.

```typescript
{
  id: string;                        // Fixture ID (wf-NNN)
  description: string;               // Human-readable intent
  input: {
    tenantId: string;
    events: NormalizedEvent[];       // Slice of events to feed the DAG engine
  };
  expected: {
    workflowKey: string | null;      // null = no workflow expected
    workflowName: string | null;
    confidence: { min: number; max: number };
    avgMinutesPerRun: { min: number; max: number } | null;
    monthlyRuns: { min: number; max: number } | null;
    nodes: Array<{ actor: string; tool: string; action: string; sequence: number }>;
    edges: Array<{ fromSequence: number; toSequence: number }>;
  };
  label: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "NO_WORKFLOW";
  tags: string[];
}
```

**Actor wildcard**: `"*"` in `expected.nodes[].actor` means any actor is acceptable at that sequence position.

### `feasibility.fixtures.jsonl`

Each record tests `FeasibilityResult` and optionally `HlcRoiResult` against labeled ranges.

```typescript
{
  id: string;                        // Fixture ID (fs-NNN)
  description: string;
  input: FeasibilityInput | { workflowId; tenantId; hlcRoiInput: HlcRoiInput };
  expected: {
    feasibilityScore?: { min: number; max: number };
    confidence?: { min: number; max: number };
    breakdown?: {
      processStability: { min; max };
      integrationComplexity: { min; max };
      dataAvailability: { min; max };
      exceptionRisk: { min; max };
    };
    recommendationStatus?: RecommendationStatus;
    reviewStatus?: ReviewStatus;
    // HLC/ROI fields (fs-007, fs-008):
    annualLaborCost?: { min; max };
    annualNetSavings?: { min; max };
    paybackMonths?: number | null;   // null = no payback (negative ROI)
    automationCoverage?: { min; max };
    roiScore?: { min; max };
  };
  label: string;
  rationale_required?: boolean;
  gating_assertion?: string;        // Prose assertion to verify in test
  formula_note?: string;            // Documents the formula used
  tags: string[];
}
```

### `adversarial.corpus.jsonl`

Each record tests that the pipeline **rejects, sanitizes, or routes correctly** malicious/unexpected inputs.

```typescript
{
  id: string;                        // Fixture ID (adv-NNN)
  category: string;                  // Attack category
  description: string;
  input: { ... };                    // Malformed or adversarial payload
  expected_behavior: string;         // What the pipeline MUST do
  must_not: string[];                // Behaviors that MUST NOT happen
  severity: "HIGH" | "MEDIUM" | "LOW";
}
```

---

## Usage in Tests (Vitest)

```typescript
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { describe, it, expect } from 'vitest';

async function loadFixtures(path: string) {
  const rl = readline.createInterface({ input: createReadStream(path) });
  const fixtures: unknown[] = [];
  for await (const line of rl) {
    if (line.trim()) fixtures.push(JSON.parse(line));
  }
  return fixtures;
}

describe('Workflow extraction fixtures', () => {
  it.each(await loadFixtures('./evals/workflows.fixtures.jsonl'))(
    '$id: $description',
    async (fixture) => {
      const result = await extractWorkflows(fixture.input);
      if (fixture.label === 'NO_WORKFLOW') {
        expect(result).toBeNull();
      } else {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence.min);
        expect(result.confidence).toBeLessThanOrEqual(fixture.expected.confidence.max);
      }
    }
  );
});
```

---

## Confidence Bands Quick Reference

| Band | Range | Routing |
|------|-------|---------|
| High | ≥ 0.80 | AUTO_APPROVED |
| Medium | 0.70 – 0.79 | AUTO_APPROVED (borderline, monitor) |
| Review gate | < 0.70 | PENDING_REVIEW → analyst queue |
| Low | < 0.45 | NOT_RECOMMENDED |

See `docs/decision/calibration-thresholds.md` for full calibration guidance.
