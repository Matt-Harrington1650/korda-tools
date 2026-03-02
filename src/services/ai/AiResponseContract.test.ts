import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/errors';
import { validateAiResponseContract } from './AiResponseContract';

describe('validateAiResponseContract', () => {
  it('rejects responses that omit required citations', () => {
    const payload = JSON.stringify({
      answer_text: 'Summary',
      confidence_score: 0.92,
      citations: [],
      corpus_coverage_pct: 88,
      last_updated_date: '2026-03-01T00:00:00.000Z',
      review_required: false,
      review_reasons: [],
    });

    expect(() => validateAiResponseContract(payload, 'Internal')).toThrowError(AppError);
    expect(() => validateAiResponseContract(payload, 'Internal')).toThrowError(
      expect.objectContaining({ code: 'AI_POLICY_CONTRACT_VIOLATION' }),
    );
  });

  it('flags mandatory review for low confidence and low coverage', () => {
    const payload = JSON.stringify({
      answer_text: 'Needs review',
      confidence_score: 0.62,
      citations: [
        {
          artifact_id: 'artifact-1',
          title: 'Issued Drawing',
          revision: 'R2',
          issue_date: '2026-02-25T00:00:00.000Z',
          is_record_of_authority: false,
        },
      ],
      corpus_coverage_pct: 35,
      last_updated_date: '2026-02-25T00:00:00.000Z',
      review_required: false,
      review_reasons: [],
    });

    const result = validateAiResponseContract(payload, 'Internal');
    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons).toEqual(expect.arrayContaining(['low_confidence', 'low_coverage']));
  });

  it('flags sensitive classification for human review even with high confidence', () => {
    const payload = JSON.stringify({
      answer_text: 'High confidence but sensitive',
      confidence_score: 0.94,
      citations: [
        {
          artifact_id: 'artifact-2',
          title: 'Spec Book',
          revision: 'R1',
          issue_date: '2026-02-28T00:00:00.000Z',
          is_record_of_authority: false,
        },
      ],
      corpus_coverage_pct: 92,
      last_updated_date: '2026-02-28T00:00:00.000Z',
      review_required: false,
      review_reasons: [],
    });

    const result = validateAiResponseContract(payload, 'Client-Confidential');
    expect(result.reviewRequired).toBe(true);
    expect(result.reviewReasons).toContain('sensitive_classification');
  });
});
