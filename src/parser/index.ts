/** Parser 모듈. */

export type SourceOrg = 'SH' | 'LH';

export type ApplicationType =
  | 'PUBLIC_RENTAL'
  | 'PUBLIC_SALE'
  | 'JEONSE_RENTAL'
  | 'PURCHASE_RENTAL'
  | 'REDEVELOPMENT_SPECIAL'
  | 'UNKNOWN';

export type JudgementGradeCap = '확정 가능' | '검토필요';

type ParserLog = {
  trace_id: string;
  failure_reason: string | null;
  source_snapshot_ref: string | null;
  metadata: {
    failure_reasons: string[];
    ambiguous_fragments: string[];
  };
};

export type ParseInputItem = {
  sourceId?: string;
  announcement_id: string;
  title?: string;
  /** 원문 링크 대응 값(빈 문자열/공백/undefined는 null 처리). */
  detail_url?: string | null;
  /** 신청기간 대응 값(POC에서는 posted_at을 사용, 빈 문자열/공백/undefined는 null 처리). */
  posted_at?: string | null;
  source_org?: SourceOrg | null;
  application_type_raw?: string | null;
  eligibility_rules_raw?: string | null;
  source_snapshot_ref?: string | null;
};

export type ParsedItem = {
  sourceId: string;
  title: string;
  /** 원문 링크(측정용 필드). */
  original_link: string | null;
  /** 신청기간 대응 값(측정용 필드, POC에서는 posted_at 원문을 그대로 보존). */
  application_period: string | null;
  source_org: SourceOrg | null;
  announcement_id: string;
  application_type_raw: string | null;
  application_type: ApplicationType;
  eligibility_rules_raw: string | null;
  region_requirement: string | null;
  household_requirement: string | null;
  income_requirement: string | null;
  asset_requirement: string | null;
  judgement_grade_cap: JudgementGradeCap;
  log: ParserLog;
};

const APPLICATION_TYPE_RULES: Array<{
  normalized: Exclude<ApplicationType, 'UNKNOWN'>;
  keywords: string[];
}> = [
  {
    normalized: 'PUBLIC_RENTAL',
    keywords: ['국민임대', '영구임대', '행복주택', '장기전세', '통합공공임대', '공공임대'],
  },
  {
    normalized: 'PUBLIC_SALE',
    keywords: ['공공분양', '신혼희망타운', '분양'],
  },
  {
    normalized: 'JEONSE_RENTAL',
    keywords: ['전세임대'],
  },
  {
    normalized: 'PURCHASE_RENTAL',
    keywords: ['매입임대'],
  },
  {
    normalized: 'REDEVELOPMENT_SPECIAL',
    keywords: ['재개발', '재건축', '이주대책', '특별공급'],
  },
];

const AMBIGUOUS_RULE_KEYWORDS = ['추후', '별도', '상이', '참조', '예외', '추가 안내'];
const SH_COLLECTOR_LIST_URL =
  'https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247/list.do?multi_itm_seq=0';

const inferSourceOrg = (announcementId: string): SourceOrg | null => {
  if (announcementId.startsWith('SH-')) {
    return 'SH';
  }

  if (announcementId.startsWith('LH-')) {
    return 'LH';
  }

  return null;
};

const normalizeTextOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOriginalLinkOrNull = (value: string | null | undefined): string | null => {
  const normalized = normalizeTextOrNull(value);

  if (normalized === null) {
    return null;
  }

  try {
    const normalizedUrl = new URL(normalized);
    const fallbackUrl = new URL(SH_COLLECTOR_LIST_URL);

    if (
      normalizedUrl.origin === fallbackUrl.origin &&
      normalizedUrl.pathname === fallbackUrl.pathname &&
      normalizedUrl.search === fallbackUrl.search
    ) {
      return null;
    }
  } catch {
    return normalized;
  }

  return normalized;
};

const inferApplicationTypeRaw = (title?: string): string | null => {
  const normalizedTitle = normalizeTextOrNull(title);

  if (normalizedTitle === null) {
    return null;
  }

  const matchedRule = APPLICATION_TYPE_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalizedTitle.includes(keyword)),
  );

  if (matchedRule === undefined) {
    return null;
  }

  const keyword = matchedRule.keywords.find((candidate) => normalizedTitle.includes(candidate));
  return keyword ?? null;
};

const normalizeApplicationType = (
  applicationTypeRaw: string | null,
): { type: ApplicationType; failureReason: string | null } => {
  if (applicationTypeRaw === null) {
    return {
      type: 'UNKNOWN',
      failureReason: 'UNMAPPED_APPLICATION_TYPE',
    };
  }

  const matchedRule = APPLICATION_TYPE_RULES.find((rule) =>
    rule.keywords.some((keyword) => applicationTypeRaw.includes(keyword)),
  );

  if (matchedRule === undefined) {
    return {
      type: 'UNKNOWN',
      failureReason: 'UNMAPPED_APPLICATION_TYPE',
    };
  }

  return {
    type: matchedRule.normalized,
    failureReason: null,
  };
};

const splitCompositeClause = (token: string): string[] => {
  const splitRegex = /(?=무주택|신혼부부|청년|고령자|도시근로자|총자산|(?<!총)자산|자동차)/g;
  const parts = token
    .split(splitRegex)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return [token];
  }

  return parts;
};

const tokenizeRules = (eligibilityRulesRaw: string | null): string[] => {
  if (eligibilityRulesRaw === null) {
    return [];
  }

  return eligibilityRulesRaw
    .split(/,\s+|\s*\/\s*|\n/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .flatMap((token) => splitCompositeClause(token));
};

const parseEligibilityRequirement = (
  eligibilityRulesRaw: string | null,
): Pick<
  ParsedItem,
  | 'region_requirement'
  | 'household_requirement'
  | 'income_requirement'
  | 'asset_requirement'
> => {
  const ruleTokens = tokenizeRules(eligibilityRulesRaw);

  const pickByKeyword = (keywords: string[]): string | null => {
    const token = ruleTokens.find((candidate) =>
      keywords.some((keyword) => candidate.includes(keyword)),
    );
    return token ?? null;
  };

  return {
    region_requirement: pickByKeyword(['서울', '경기', '인천', '거주']),
    household_requirement: pickByKeyword([
      '무주택',
      '세대구성원',
      '신혼부부',
      '청년',
      '고령자',
    ]),
    income_requirement: pickByKeyword(['소득']),
    asset_requirement: pickByKeyword(['총자산', '자산', '자동차']),
  };
};

const collectAmbiguousFragments = (eligibilityRulesRaw: string | null): string[] => {
  const ruleTokens = tokenizeRules(eligibilityRulesRaw);

  return ruleTokens.filter((token) =>
    AMBIGUOUS_RULE_KEYWORDS.some((keyword) => token.includes(keyword)),
  );
};

const isMissingValue = (value: string | SourceOrg | null): boolean => {
  return value === null || value === '';
};

const toParseInputItem = (item: string | ParseInputItem): ParseInputItem => {
  if (typeof item === 'string') {
    return {
      announcement_id: item,
    };
  }

  return item;
};

export const parse = (items: Array<string | ParseInputItem>): ParsedItem[] => {
  return items.map((item) => {
    const input = toParseInputItem(item);
    const announcementId = input.announcement_id;
    const sourceOrg = input.source_org ?? inferSourceOrg(announcementId);
    const originalLink = normalizeOriginalLinkOrNull(input.detail_url);
    const applicationPeriod = normalizeTextOrNull(input.posted_at);
    const normalizedApplicationTypeRaw = normalizeTextOrNull(input.application_type_raw);
    const applicationTypeRaw =
      normalizedApplicationTypeRaw ?? inferApplicationTypeRaw(input.title) ?? null;
    const eligibilityRulesRaw = normalizeTextOrNull(input.eligibility_rules_raw);

    const normalizedApplicationType = normalizeApplicationType(applicationTypeRaw);
    const parsedRequirement = parseEligibilityRequirement(eligibilityRulesRaw);

    const parsedItem: ParsedItem = {
      sourceId: input.sourceId ?? announcementId,
      title: input.title ?? '샘플 공고',
      original_link: originalLink,
      application_period: applicationPeriod,
      source_org: sourceOrg,
      announcement_id: announcementId,
      application_type_raw: applicationTypeRaw,
      application_type: normalizedApplicationType.type,
      eligibility_rules_raw: eligibilityRulesRaw,
      region_requirement: parsedRequirement.region_requirement,
      household_requirement: parsedRequirement.household_requirement,
      income_requirement: parsedRequirement.income_requirement,
      asset_requirement: parsedRequirement.asset_requirement,
      judgement_grade_cap: '확정 가능',
      log: {
        trace_id: `trace-${announcementId.toLowerCase()}`,
        failure_reason: null,
        source_snapshot_ref: input.source_snapshot_ref ?? null,
        metadata: {
          failure_reasons: [],
          ambiguous_fragments: [],
        },
      },
    };

    const requiredFieldValues: Record<string, string | SourceOrg | null> = {
      source_org: parsedItem.source_org,
      announcement_id: parsedItem.announcement_id,
      application_type_raw: parsedItem.application_type_raw,
      eligibility_rules_raw: parsedItem.eligibility_rules_raw,
      region_requirement: parsedItem.region_requirement,
      household_requirement: parsedItem.household_requirement,
      income_requirement: parsedItem.income_requirement,
      asset_requirement: parsedItem.asset_requirement,
    };

    const failureReasons: string[] = Object.entries(requiredFieldValues)
      .filter(([, value]) => isMissingValue(value))
      .map(([fieldName]) => `MISSING_REQUIRED_FIELD: ${fieldName}`);

    if (normalizedApplicationType.failureReason !== null) {
      failureReasons.push(normalizedApplicationType.failureReason);
    }

    const ambiguousFragments = collectAmbiguousFragments(eligibilityRulesRaw);
    if (ambiguousFragments.length > 0) {
      failureReasons.push('AMBIGUOUS_RULE_TEXT: interpretation-required');
    }

    if (failureReasons.length > 0) {
      parsedItem.judgement_grade_cap = '검토필요';
      parsedItem.log.failure_reason = failureReasons[0] ?? null;
      parsedItem.log.metadata.failure_reasons = failureReasons;
      parsedItem.log.metadata.ambiguous_fragments = ambiguousFragments;
    }

    return parsedItem;
  });
};
