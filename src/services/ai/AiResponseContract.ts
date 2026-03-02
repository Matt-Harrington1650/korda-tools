import { AppError } from '../../lib/errors';
import type { SensitivityLevel } from '../policy/types';

const OUTDATED_THRESHOLD_DAYS = 180;

export interface AiCitation {
  artifactId: string;
  title: string;
  revision: string;
  issueDate: string;
  status?: string;
  isRecordOfAuthority?: boolean;
}

export interface AiResponseContract {
  answerText: string;
  confidenceScore: number;
  citations: AiCitation[];
  corpusCoveragePct: number;
  newestSourceDate: string;
  reviewRequired: boolean;
  reviewReasons: string[];
}

export interface AiPolicyResult {
  contract: AiResponseContract;
  reviewRequired: boolean;
  reviewReasons: string[];
}

export function validateAiResponseContract(
  rawResponseBody: string,
  sensitivityLevel: SensitivityLevel,
  nowUtc = new Date(),
): AiPolicyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseBody);
  } catch (error) {
    throw new AppError('AI_POLICY_CONTRACT_VIOLATION', 'AI response must be valid JSON.', error);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError('AI_POLICY_CONTRACT_VIOLATION', 'AI response must be a JSON object.');
  }

  const payload = parsed as Record<string, unknown>;
  const answerText = requireString(payload, ['answer_text', 'answerText']);
  const confidenceScore = requireNumberInRange(payload, ['confidence_score', 'confidenceScore'], 0, 1);
  const corpusCoveragePct = requireNumberInRange(payload, ['corpus_coverage_pct', 'corpusCoveragePct'], 0, 100);
  const newestSourceDate = requireIsoDate(payload, ['last_updated_date', 'lastUpdatedDate', 'newest_source_date']);
  const citations = requireCitations(payload, ['citations']);

  const reviewReasons = new Set<string>(readStringArray(payload, ['review_reasons', 'reviewReasons']));
  if (confidenceScore < 0.7) {
    reviewReasons.add('low_confidence');
  }
  if (corpusCoveragePct < 40) {
    reviewReasons.add('low_coverage');
  }
  if (sensitivityLevel === 'Confidential' || sensitivityLevel === 'Client-Confidential') {
    reviewReasons.add('sensitive_classification');
  }
  if (isOutdated(newestSourceDate, nowUtc)) {
    reviewReasons.add('outdated_source');
  }
  if (hasConflictingCitations(citations)) {
    reviewReasons.add('source_conflict');
  }
  if (citations.some((citation) => citation.isRecordOfAuthority === true)) {
    reviewReasons.add('authority_interpretation_limit');
  }

  const declaredReviewRequired = readBoolean(payload, ['review_required', 'reviewRequired']) ?? false;
  const computedReviewRequired = declaredReviewRequired || reviewReasons.size > 0;
  const finalReviewReasons = [...reviewReasons].sort();

  return {
    contract: {
      answerText,
      confidenceScore,
      citations,
      corpusCoveragePct,
      newestSourceDate,
      reviewRequired: computedReviewRequired,
      reviewReasons: finalReviewReasons,
    },
    reviewRequired: computedReviewRequired,
    reviewReasons: finalReviewReasons,
  };
}

function requireString(payload: Record<string, unknown>, keys: readonly string[]): string {
  const value = readFirst(payload, keys);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Missing or invalid required string field: ${keys[0]}.`,
    );
  }
  return value.trim();
}

function requireIsoDate(payload: Record<string, unknown>, keys: readonly string[]): string {
  const value = requireString(payload, keys);
  if (Number.isNaN(Date.parse(value))) {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Missing or invalid ISO date field: ${keys[0]}.`,
      { value },
    );
  }
  return value;
}

function requireNumberInRange(
  payload: Record<string, unknown>,
  keys: readonly string[],
  min: number,
  max: number,
): number {
  const value = readFirst(payload, keys);
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Missing or invalid numeric field: ${keys[0]}.`,
      { min, max, value },
    );
  }
  return value;
}

function requireCitations(payload: Record<string, unknown>, keys: readonly string[]): AiCitation[] {
  const value = readFirst(payload, keys);
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      'AI response must include at least one citation.',
    );
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(
        'AI_POLICY_CONTRACT_VIOLATION',
        `Citation at index ${index} must be an object.`,
      );
    }
    const citation = item as Record<string, unknown>;

    return {
      artifactId: requireString(citation, ['artifact_id', 'artifactId']),
      title: requireString(citation, ['title']),
      revision: requireString(citation, ['revision']),
      issueDate: requireIsoDate(citation, ['issue_date', 'issueDate']),
      status: optionalString(citation, ['status']),
      isRecordOfAuthority: readBoolean(citation, ['is_record_of_authority', 'isRecordOfAuthority']) ?? false,
    };
  });
}

function optionalString(payload: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const value = readFirst(payload, keys);
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Invalid string field: ${keys[0]}.`,
      { value },
    );
  }
  return value.trim();
}

function readStringArray(payload: Record<string, unknown>, keys: readonly string[]): string[] {
  const value = readFirst(payload, keys);
  if (typeof value === 'undefined' || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Invalid string-array field: ${keys[0]}.`,
      { value },
    );
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function readBoolean(payload: Record<string, unknown>, keys: readonly string[]): boolean | undefined {
  const value = readFirst(payload, keys);
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new AppError(
      'AI_POLICY_CONTRACT_VIOLATION',
      `Invalid boolean field: ${keys[0]}.`,
      { value },
    );
  }
  return value;
}

function readFirst(payload: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return payload[key];
    }
  }
  return undefined;
}

function isOutdated(isoDate: string, nowUtc: Date): boolean {
  const millis = Date.parse(isoDate);
  if (Number.isNaN(millis)) {
    return true;
  }
  const ageMs = nowUtc.getTime() - millis;
  const thresholdMs = OUTDATED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  return ageMs > thresholdMs;
}

function hasConflictingCitations(citations: readonly AiCitation[]): boolean {
  const seen = new Map<string, string>();
  for (const citation of citations) {
    const existing = seen.get(citation.artifactId);
    if (existing && existing !== citation.revision) {
      return true;
    }
    seen.set(citation.artifactId, citation.revision);
  }
  return false;
}
