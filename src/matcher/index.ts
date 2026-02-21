/** Matcher 모듈. */

import type { ParsedItem } from '../parser/index.js';

export type MatchGrade = '확정 가능' | '유력' | '검토필요' | '부적합';

export type MatchedItem = ParsedItem & {
  grade: MatchGrade;
  reasons: string[];
};

const MISSING_REQUIREMENT_FIELDS: Array<
  keyof Pick<ParsedItem, 'region_requirement' | 'income_requirement' | 'asset_requirement'>
> = ['region_requirement', 'income_requirement', 'asset_requirement'];

const HOUSEHOLD_DISQUALIFYING_PATTERNS: RegExp[] = [
  /유주택/,
  /주택\s*소유/,
  /무주택\s*아님/,
  /1주택/,
  /2주택/,
];

const hasMissingRequirementData = (item: ParsedItem): boolean => {
  return MISSING_REQUIREMENT_FIELDS.some((field) => {
    return item[field] === null;
  });
};

const hasUnknownOrAmbiguousContext = (item: ParsedItem): boolean => {
  if (item.application_type === 'UNKNOWN') {
    return true;
  }

  if (item.log.metadata.ambiguous_fragments.length > 0) {
    return true;
  }

  return item.log.metadata.failure_reasons.some((reason) => {
    return reason.startsWith('AMBIGUOUS_RULE_TEXT');
  });
};

const hasLegalDisqualifyingSignal = (item: ParsedItem): boolean => {
  const legalSignals = [item.household_requirement, item.eligibility_rules_raw]
    .filter((value): value is string => value !== null)
    .join(' ');

  if (legalSignals.length === 0) {
    return false;
  }

  return HOUSEHOLD_DISQUALIFYING_PATTERNS.some((pattern) => pattern.test(legalSignals));
};

const evaluateInitialGrade = (item: ParsedItem): Pick<MatchedItem, 'grade' | 'reasons'> => {
  const reasons: string[] = [];

  if (hasLegalDisqualifyingSignal(item)) {
    reasons.push('LEGAL_REQUIREMENT_VIOLATION: household_requirement');

    return {
      grade: '부적합',
      reasons,
    };
  }

  if (hasUnknownOrAmbiguousContext(item)) {
    reasons.push('REVIEW_REQUIRED: UNKNOWN_APPLICATION_TYPE_OR_AMBIGUITY');

    return {
      grade: '검토필요',
      reasons,
    };
  }

  if (hasMissingRequirementData(item)) {
    reasons.push('REVIEW_CAP_APPLIED: MISSING_REGION_OR_INCOME_OR_ASSET');

    return {
      grade: '검토필요',
      reasons,
    };
  }

  return {
    grade: '유력',
    reasons: ['INITIAL_RULE_MATCH: conservative-pass'],
  };
};

export const match = (parsedItems: ParsedItem[]): MatchedItem[] => {
  return parsedItems.map((item) => {
    const initialDecision = evaluateInitialGrade(item);

    return {
      ...item,
      grade: initialDecision.grade,
      reasons: initialDecision.reasons,
    };
  });
};
