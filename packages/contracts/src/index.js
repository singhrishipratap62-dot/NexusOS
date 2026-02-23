"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_THRESHOLD = exports.FEASIBILITY_RATIONALE_JSON_SCHEMA = void 0;
exports.FEASIBILITY_RATIONALE_JSON_SCHEMA = {
    $id: 'https://nexusos.dev/schema/feasibility-rationale-v1.json',
    type: 'object',
    additionalProperties: false,
    required: ['version', 'summary', 'blockers', 'assumptions', 'confidence'],
    properties: {
        version: { type: 'string', const: '1' },
        summary: { type: 'string', minLength: 1, maxLength: 600 },
        blockers: {
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 200 },
            maxItems: 8
        },
        assumptions: {
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 200 },
            maxItems: 8
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
    }
};
exports.REVIEW_THRESHOLD = 0.7;
