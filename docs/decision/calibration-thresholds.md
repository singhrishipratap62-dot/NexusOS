# Scoring Calibration Thresholds — NexusOS Day-1 Audit MVP

**Status**: Approved for Day-1 MVP
**Owner**: Claude (quality artifact + active implementer while Codex is on break)
**Last updated**: 2026-02-23
**Source of truth**: `packages/shared/src/scoring.ts` — this doc reflects that code exactly.

---

## 1. Hard Gate: Review Threshold

```
REVIEW_THRESHOLD = 0.70   (defined in packages/contracts/src/index.ts)
```

**Rule**: Any workflow or feasibility output with `confidence < 0.70` MUST be routed to `reviewStatus = PENDING_REVIEW` and `recommendationStatus = NEEDS_REVIEW`. This is non-negotiable and must be enforced in CDX-09.

---

## 2. Workflow Confidence Bands

Confidence is computed deterministically from event co-occurrence frequency, actor consistency, and sequence stability.

| Band | Range | Routing |
|------|-------|---------|
| High | ≥ 0.80 | AUTO_APPROVED — eligible for RECOMMENDED |
| Borderline | 0.70 – 0.79 | AUTO_APPROVED — monitor; analyst can demote |
| Review gate | < 0.70 | PENDING_REVIEW — analyst must approve before RECOMMENDED |
| Low | < 0.45 | NOT_RECOMMENDED (skip unless analyst overrides) |

**Calibration signal**: Fixture `wf-001` (invoice approval, 2 actors, low variance) targets ≥ 0.80. Fixture `wf-003` (bug triage, 8 actors, high variance) targets 0.30–0.65. Use these as anchors when tuning the DAG confidence formula.

---

## 3. Feasibility Score Bands

Feasibility score is the weighted composite of four sub-scores. Each sub-score is in [0, 1].

| Sub-score | Weight | Driver |
|-----------|--------|--------|
| processStability | **0.32** | varianceRatio (lower = better) |
| integrationComplexity | **0.24** | uniqueToolCount (fewer = simpler) |
| dataAvailability | **0.26** | eventCount30d (higher = better) |
| exceptionRisk | **0.18** | uniqueActorCount (fewer = more consistent) |

> **Weights match `FEASIBILITY_SCORE_WEIGHTS` in `packages/shared/src/scoring.ts`.**
> Previous draft had 0.35/0.25/0.25/0.15 — those are superseded by the live implementation.

**Composite formula**:
```
feasibilityScore =
  0.32 * processStability
+ 0.24 * integrationComplexity
+ 0.26 * dataAvailability
+ 0.18 * exceptionRisk
```

| Band | Score Range | Action |
|------|-------------|--------|
| Automate | ≥ 0.80 | RECOMMENDED |
| Conditional | 0.70 – 0.79 | RECOMMENDED (with analyst review optional) |
| Needs review | 0.50 – 0.69 | NEEDS_REVIEW — route to analyst |
| Not recommended | < 0.50 | NOT_RECOMMENDED |

---

## 4. Sub-Score Derivation Guidelines

### processStability
```typescript
// packages/shared/src/scoring.ts
const processStability = clamp01(1 - input.varianceRatio);
```
- `varianceRatio` 0.0 → 1.0 (perfectly stable)
- `varianceRatio` 1.0 → 0.0 (fully chaotic)
- Inputs are clamped to [0,1]; values above 1.0 produce 0.0

### integrationComplexity
```typescript
const integrationComplexity = clamp01(1 - (input.uniqueToolCount - 1) * 0.12);
```
- 1 tool → 1.0
- 2 tools → 0.88 (Slack + Gmail = standard Day-1 case)
- 9+ tools → clamped to 0.0

### dataAvailability
```typescript
const dataAvailability = clamp01(Math.min(1, input.eventCount30d / 60));
```
- 0 events → 0.0
- 60+ events → 1.0 (saturation point is 60, not 100)
- 30 events → 0.50

### exceptionRisk
```typescript
const exceptionRisk = clamp01(1 - (input.uniqueActorCount - 1) * 0.08);
```
- 1 actor → 1.0 (deterministic ownership)
- 5 actors → 0.68
- 13+ actors → clamped to 0.0

---

## 5. HLC + ROI Formulas

```typescript
// packages/shared/src/scoring.ts  — scoreHlcRoi()
annualLaborCost    = (avgMinutesPerRun / 60) * monthlyRuns * 12 * blendedHourlyRate
automationCoverage = clamp01(feasibilityScore * 0.85)          // 85% multiplier constant
annualGrossSavings = annualLaborCost * automationCoverage
annualNetSavings   = annualGrossSavings - annualPlatformCost   // NOTE: no implementationCost amortisation in net savings
paybackMonths      = implementationCost / (annualNetSavings / 12)  // null if annualNetSavings <= 0
roiScore           = clamp01((max(0, annualNetSavings) / max(1, implementationCost + annualPlatformCost)) * 1.5)
```

**Key differences from earlier draft**:
- `annualNetSavings` deducts only `annualPlatformCost`, not amortised `implementationCost` (payback period is captured separately via `paybackMonths`)
- `automationCoverage = feasibilityScore × 0.85` (not `= feasibilityScore`)
- `roiScore` denominator uses `implementationCost + annualPlatformCost`, scaled by 1.5

**Rounding policy**: Monetary values → 2 dp. Scores → 4 dp. `paybackMonths` → 2 dp (not ceiling — rounded to nearest 0.01 month).

**Calibration anchors**:
- `fs-007` (invoice approval, feasibility=0.88): expect annualLaborCost ≈ $3,267, payback < 36 months
- `fs-008` (bug triage, feasibility=0.32): expect negative annualNetSavings, paybackMonths=null

---

## 6. LLM Rationale: When to Call and Fail-Closed Policy

**Call LLM rationale only when**:
- `feasibilityScore` is in the range 0.40–0.85 (ambiguous zone)
- `confidence < 0.80` (uncertain extraction)

**Skip LLM rationale when**:
- Score ≥ 0.85 AND confidence ≥ 0.80 (high confidence, deterministic output sufficient)
- Score < 0.40 (not recommended, no rationale needed)

**Fail-closed**:
- Validate LLM output against `FEASIBILITY_RATIONALE_JSON_SCHEMA` (in contracts)
- If validation fails → set `rationale = undefined`, log error, continue
- NEVER surface invalid rationale to clients
- NEVER let rationale failure block scoring pipeline

---

## 7. Adversarial Defense Thresholds

| Check | Rule |
|-------|------|
| Message text as LLM input | Strip/truncate to 500 chars before prompting; treat as data, not instruction |
| Email subject as LLM input | Strip to 200 chars; sanitize prompt-injection patterns |
| varianceRatio > 1.0 | Clamp to 1.0 |
| uniqueActorCount < 0 | Clamp to 0 |
| avgMinutesPerRun < 0 | Clamp to 0 |
| eventCount30d < 0 | Clamp to 0 |
| blendedHourlyRate = 0 | annualLaborCost = 0, skip ROI, paybackMonths = null |
| Duplicate externalId | Upsert by (tenantId, provider, externalId) — do not double-count |

---

## 8. Verified Implementation Checklist

All items below are **confirmed implemented** in the live codebase as of 2026-02-23.

- [x] `REVIEW_THRESHOLD = 0.70` imported from `@nexus/contracts` — not hardcoded (`scoring.ts` line 92)
- [x] Sub-score formulas match section 4 exactly (`scoring.ts` lines 29-32)
- [x] `automationCoverage = feasibilityScore × 0.85` (`scoring.ts` line 59-61)
- [x] `paybackMonths` is `null` (not 0, not Infinity) when `annualNetSavings ≤ 0` (`scoring.ts` line 65-66)
- [x] LLM rationale fails closed: Ajv validation failure → throws, pipeline catches → `rationale=undefined` (`feasibility.service.ts` lines 25-28)
- [x] Inputs are clamped via `clamp01()` throughout (`scoring.ts`)
- [x] `evals/feasibility.fixtures.jsonl` exists; wire into Vitest via pattern in `evals/README.md`
- [x] `BLENDED_HOURLY_RATE`, `IMPLEMENTATION_COST_DEFAULT`, `ANNUAL_PLATFORM_COST` now in `.env.example` and `.env`
