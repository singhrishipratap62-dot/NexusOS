import { Injectable } from '@nestjs/common';
import Ajv from 'ajv';
import {
  FEASIBILITY_RATIONALE_JSON_SCHEMA,
  FeasibilityInput,
  FeasibilityRationale,
  FeasibilityResult
} from '@nexus/contracts';
import { scoreFeasibility } from '@nexus/shared';

@Injectable()
export class FeasibilityService {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });
  private readonly validateRationale = this.ajv.compile<FeasibilityRationale>(
    FEASIBILITY_RATIONALE_JSON_SCHEMA
  );

  score(input: FeasibilityInput, llmOutput?: unknown): FeasibilityResult {
    const baseResult = scoreFeasibility(input);

    if (llmOutput === undefined) {
      return baseResult;
    }

    if (!this.validateRationale(llmOutput)) {
      const reason = this.ajv.errorsText(this.validateRationale.errors);
      throw new Error(`Invalid LLM rationale JSON: ${reason}`);
    }

    return {
      ...baseResult,
      rationale: llmOutput,
      confidence: Number(Math.min(baseResult.confidence, llmOutput.confidence).toFixed(4))
    };
  }

  buildRationaleStub(input: FeasibilityInput): FeasibilityRationale {
    return {
      version: '1',
      summary: `Workflow ${input.workflowId} has repeatable patterns and moderate integration complexity.`,
      blockers:
        input.uniqueToolCount > 4
          ? ['Integration span is large and may require middleware.']
          : ['No major blockers beyond standard API quota controls.'],
      assumptions: [
        'Read-only connector scopes remain unchanged.',
        'Process ownership remains with current teams.'
      ],
      confidence: Number(Math.min(0.95, 0.55 + input.eventCount30d / 120).toFixed(4))
    };
  }
}
