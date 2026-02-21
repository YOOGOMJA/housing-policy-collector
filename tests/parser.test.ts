import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyParserReviewReason,
  parse,
} from '../src/parser/index.js';

const SH_COLLECTOR_LIST_URL =
  'https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247/list.do?multi_itm_seq=0';

const isCompleteRequiredField = (item: {
  title: string;
  source_org: 'SH' | 'LH' | null;
  application_period: string | null;
  original_link: string | null;
}): boolean => {
  if (item.source_org === null) {
    return false;
  }

  return [item.title, item.application_period, item.original_link].every(
    (value) => value !== null && value.trim().length > 0,
  );
};

test('parse: application_type을 정책 enum으로 정규화한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-001-1',
      source_org: 'SH',
      detail_url: 'https://example.test/sh/2026-001',
      posted_at: '2026-03-01',
      application_type_raw: '행복주택(공공임대)',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하',
    },
  ]);

  assert.equal(parsed.application_type, 'PUBLIC_RENTAL');
  assert.equal(parsed.original_link, 'https://example.test/sh/2026-001');
  assert.equal(parsed.application_period, '2026-03-01');
  assert.equal(parsed.judgement_grade_cap, '확정 가능');
  assert.equal(parsed.region_requirement, '서울시 거주');
  assert.equal(parsed.household_requirement, '무주택세대구성원');
  assert.equal(parsed.income_requirement, '도시근로자 월평균소득 100% 이하');
  assert.equal(parsed.asset_requirement, '총자산 3억 6,100만원 이하');
  assert.equal(parsed.log.failure_reason, null);
});

test('parse: 결합된 자격요건 문구를 필드별로 분리한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-001-1',
      source_org: 'SH',
      detail_url: 'https://example.test/sh/2026-001',
      posted_at: '2026-03-01',
      application_type_raw: '행복주택(공공임대)',
      eligibility_rules_raw:
        '서울시 거주 무주택세대구성원 도시근로자 월평균소득 100% 이하 총자산 3억 6,100만원 이하',
    },
  ]);

  assert.equal(parsed.region_requirement, '서울시 거주');
  assert.equal(parsed.household_requirement, '무주택세대구성원');
  assert.equal(parsed.income_requirement, '도시근로자 월평균소득 100% 이하');
  assert.equal(parsed.asset_requirement, '총자산 3억 6,100만원 이하');
});

test('parse: 필수 필드 누락 시 judgement_grade_cap을 검토필요로 제한한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'LH-2026-77-1',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/2026-77',
      posted_at: '2026-03-03',
      application_type_raw: '전세임대(청년)',
      eligibility_rules_raw: '무주택세대구성원, 도시근로자 월평균소득 70% 이하',
    },
  ]);

  assert.equal(parsed.application_type, 'JEONSE_RENTAL');
  assert.equal(parsed.judgement_grade_cap, '검토필요');
  assert.deepEqual(parsed.log.metadata.failure_reasons, [
    'MISSING_REQUIRED_FIELD: region_requirement',
    'MISSING_REQUIRED_FIELD: asset_requirement',
  ]);
});

test('parse: 분류 실패/원문 모호성 사유를 failure metadata로 남긴다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'LH-2026-RE05-1',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/2026-re05',
      posted_at: '2026-03-10',
      application_type_raw: '미래주거지원형(신규)',
      eligibility_rules_raw:
        '소득기준은 전년도 도시근로자 가구원수별 기준 적용, 단 예외 세대는 별도 심사 / 자산기준은 유형별 상이(별표 참조)',
    },
  ]);

  assert.equal(parsed.application_type, 'UNKNOWN');
  assert.equal(parsed.judgement_grade_cap, '검토필요');
  assert.equal(parsed.log.failure_reason, 'MISSING_REQUIRED_FIELD: region_requirement');
  assert.deepEqual(parsed.log.metadata.failure_reasons, [
    'MISSING_REQUIRED_FIELD: region_requirement',
    'MISSING_REQUIRED_FIELD: household_requirement',
    'UNMAPPED_APPLICATION_TYPE',
    'AMBIGUOUS_RULE_TEXT: interpretation-required',
  ]);
  assert.deepEqual(parsed.log.metadata.ambiguous_fragments, [
    '단 예외 세대는 별도 심사',
    '자산기준은 유형별 상이(별표 참조)',
  ]);
});

test('parse: title 기반으로 application_type_raw를 보완 추론한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-010-1',
      title: '2026-010 1차 행복주택 입주자 모집',
      detail_url: 'https://example.test/sh/2026-010',
      posted_at: '2026-03-20',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하',
    },
  ]);

  assert.equal(parsed.application_type_raw, '행복주택');
  assert.equal(parsed.application_type, 'PUBLIC_RENTAL');
  assert.equal(parsed.judgement_grade_cap, '확정 가능');
});

test('parse: application_type_raw가 공백이면 title 기반 추론으로 fallback한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'LH-2026-150-1',
      title: '2026-150 전세임대 청년 모집',
      detail_url: 'https://example.test/lh/2026-150',
      posted_at: '2026-03-25',
      application_type_raw: '   ',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 70% 이하, 총자산 2억 이하',
    },
  ]);

  assert.equal(parsed.application_type_raw, '전세임대');
  assert.equal(parsed.application_type, 'JEONSE_RENTAL');
  assert.equal(parsed.judgement_grade_cap, '확정 가능');
});

test('parse fixture: 필수 필드 추출률 분자/분모 계산이 가능하다', () => {
  const parsedItems = parse([
    {
      announcement_id: 'SH-2026-201-1',
      title: '2026-201 행복주택 모집',
      source_org: 'SH',
      detail_url: 'https://example.test/sh/2026-201',
      posted_at: '2026-04-01',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
    },
    {
      announcement_id: 'SH-2026-202-1',
      title: '2026-202 행복주택 모집',
      source_org: 'SH',
      detail_url: SH_COLLECTOR_LIST_URL,
      posted_at: '2026-04-02',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
    },
  ]);

  const denominator = parsedItems.length;
  const numerator = parsedItems.filter((item) =>
    isCompleteRequiredField({
      title: item.title,
      source_org: item.source_org,
      application_period: item.application_period,
      original_link: item.original_link,
    }),
  ).length;

  assert.equal(denominator, 2);
  assert.equal(numerator, 1);
});

test('parse: collector fallback list URL은 original_link를 null로 정규화한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-301-1',
      title: '2026-301 행복주택 모집',
      source_org: 'SH',
      detail_url: SH_COLLECTOR_LIST_URL,
      posted_at: '2026-05-01',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
    },
  ]);

  assert.equal(parsed.original_link, null);
  assert.equal(parsed.application_period, '2026-05-01');
});


test('parse fixture: 검토필요 사유별 비중 집계를 계산할 수 있다', () => {
  const parsedItems = parse([
    {
      announcement_id: 'LH-2026-RC-1',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/rc-1',
      posted_at: '2026-06-01',
      application_type_raw: '행복주택',
      eligibility_rules_raw: '무주택세대구성원, 도시근로자 월평균소득 70% 이하',
    },
    {
      announcement_id: 'LH-2026-RC-2',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/rc-2',
      posted_at: '2026-06-02',
      application_type_raw: '신유형주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 70% 이하, 총자산 2억 이하',
    },
    {
      announcement_id: 'LH-2026-RC-3',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/rc-3',
      posted_at: '2026-06-03',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 70% 이하, 총자산 2억 이하(세부기준 추후 별도 안내)',
    },
    {
      announcement_id: 'LH-2026-RC-4',
      source_org: 'LH',
      detail_url: 'https://example.test/lh/rc-4',
      posted_at: '2026-06-04',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 70% 이하, 총자산 2억 이하',
    },
  ]);

  const reviewItems = parsedItems.filter((item) => item.judgement_grade_cap === '검토필요');
  const totalReviewReasons = reviewItems.flatMap((item) => item.log.metadata.failure_reasons).length;

  const byCategory = reviewItems
    .flatMap((item) => item.log.metadata.failure_reasons)
    .reduce<Record<string, number>>((acc, reason) => {
      const category = classifyParserReviewReason(reason);
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});

  assert.equal(reviewItems.length, 3);
  assert.equal(totalReviewReasons, 4);
  assert.equal(byCategory.missing_field, 2);
  assert.equal(byCategory.unknown_type, 1);
  assert.equal(byCategory.ambiguity, 1);
  assert.equal(byCategory.other ?? 0, 0);
  assert.equal(byCategory.ambiguity / totalReviewReasons, 0.25);
});

// 회귀: 정상 케이스는 검토필요로 과도 분기되지 않아야 한다.
test('parse regression: 정상 구조 공고는 judgement_grade_cap=확정 가능을 유지한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-REG-1',
      title: '2026-REG-1 행복주택 모집',
      source_org: 'SH',
      detail_url: 'https://example.test/sh/reg-1',
      posted_at: '2026-06-10',
      application_type_raw: '행복주택',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
    },
  ]);

  assert.equal(parsed.judgement_grade_cap, '확정 가능');
  assert.deepEqual(parsed.log.metadata.failure_reasons, []);
  assert.deepEqual(parsed.log.metadata.ambiguous_fragments, []);
});
