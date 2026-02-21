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

const EXPLICIT_VIOLATION_PATTERNS: RegExp[] = [
  /신청자[^,.\n]{0,30}(유주택|주택\s*소유|무주택\s*아님|1주택|2주택)/,
  /(유주택|주택\s*소유|무주택\s*아님|1주택|2주택)[^,.\n]{0,20}(확인|판정|위배|위반)/,
  /무주택\s*요건[^,.\n]{0,10}(미충족|위반|위배)/,
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
  const legalContext = [item.household_requirement, item.eligibility_rules_raw]
    .filter((value): value is string => value !== null)
    .join(' ');

  if (legalContext.length === 0) {
    return false;
  }

  return EXPLICIT_VIOLATION_PATTERNS.some((pattern) => pattern.test(legalContext));
};

const evaluateInitialGrade = (item: ParsedItem): Pick<MatchedItem, 'grade' | 'reasons'> => {
  if (hasLegalDisqualifyingSignal(item)) {
    return {
      grade: '부적합',
      reasons: ['LEGAL_REQUIREMENT_VIOLATION: explicit-household-context'],
    };
  }

  if (hasUnknownOrAmbiguousContext(item)) {
    return {
      grade: '검토필요',
      reasons: ['REVIEW_REQUIRED: UNKNOWN_APPLICATION_TYPE_OR_AMBIGUITY'],
    };
  }

  if (hasMissingRequirementData(item)) {
    return {
      grade: '검토필요',
      reasons: ['REVIEW_CAP_APPLIED: MISSING_REGION_OR_INCOME_OR_ASSET'],
    };
  }

  return {
    grade: '유력',
    reasons: ['INITIAL_RULE_MATCH: conservative-pass'],
  };
};

const enforceParserJudgementCap = (
  item: ParsedItem,
  decision: Pick<MatchedItem, 'grade' | 'reasons'>,
): Pick<MatchedItem, 'grade' | 'reasons'> => {
  if (item.judgement_grade_cap !== '검토필요') {
    return decision;
  }

  if (decision.grade === '유력' || decision.grade === '확정 가능') {
    return {
      grade: '검토필요',
      reasons: [...decision.reasons, 'REVIEW_CAP_APPLIED: parser_judgement_grade_cap'],
    };
  }

  return decision;
};

export const match = (parsedItems: ParsedItem[]): MatchedItem[] => {
  return parsedItems.map((item) => {
    const initialDecision = evaluateInitialGrade(item);
    const finalDecision = enforceParserJudgementCap(item, initialDecision);

    return {
      ...item,
      grade: finalDecision.grade,
      reasons: finalDecision.reasons,
    };
  });
};
