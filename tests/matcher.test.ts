import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyMatcherReviewReason,
  match,
} from '../src/matcher/index.js';
import { parse } from '../src/parser/index.js';

test('match: 정책 문구(유주택 세대 제외)만으로는 부적합으로 단정하지 않는다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'LH-2026-002-1',
        source_org: 'LH',
        application_type_raw: '국민임대',
        eligibility_rules_raw:
          '서울시 거주, 유주택 세대 제외, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.grade, '검토필요');
  assert.ok(matched.reasons.includes('REVIEW_CAP_APPLIED: parser_judgement_grade_cap'));
});

test('match: 신청자 위반 맥락이 명시된 경우에만 부적합 처리한다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'LH-2026-002-2',
        source_org: 'LH',
        application_type_raw: '국민임대',
        eligibility_rules_raw:
          '서울시 거주, 신청자 유주택 확인으로 무주택 요건 위반 판정, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.grade, '부적합');
  assert.deepEqual(matched.reasons, ['LEGAL_REQUIREMENT_VIOLATION: explicit-household-context']);
});

test('match: application_type이 UNKNOWN이면 자동으로 검토필요 처리한다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'LH-2026-003-1',
        source_org: 'LH',
        application_type_raw: '미래주거지원형',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.grade, '검토필요');
  assert.deepEqual(matched.reasons, ['REVIEW_REQUIRED: UNKNOWN_APPLICATION_TYPE_OR_AMBIGUITY']);
});

test('match: region/income/asset 누락 시 최대 검토필요로 제한한다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'SH-2026-004-1',
        source_org: 'SH',
        application_type_raw: '행복주택',
        eligibility_rules_raw: '무주택세대구성원',
      },
    ]),
  );

  assert.equal(matched.grade, '검토필요');
  assert.deepEqual(matched.reasons, ['REVIEW_CAP_APPLIED: MISSING_REGION_OR_INCOME_OR_ASSET']);
});

test('match: parser judgement_grade_cap이 검토필요이면 유력으로 승급하지 않는다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'SH-2026-006-1',
        application_type_raw: '행복주택',
        eligibility_rules_raw: '서울시 거주, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.judgement_grade_cap, '검토필요');
  assert.equal(matched.grade, '검토필요');
  assert.deepEqual(matched.reasons, [
    'INITIAL_RULE_MATCH: conservative-pass',
    'REVIEW_CAP_APPLIED: parser_judgement_grade_cap',
  ]);
});

test('match: 핵심 요건이 확인되면 보수적으로 유력 판정한다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'SH-2026-005-1',
        source_org: 'SH',
        application_type_raw: '행복주택',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.grade, '유력');
  assert.deepEqual(matched.reasons, ['INITIAL_RULE_MATCH: conservative-pass']);
});


test('match fixture: 검토필요 사유별 비중 집계를 계산할 수 있다', () => {
  const matchedItems = match(
    parse([
      {
        announcement_id: 'LH-2026-MR-1',
        source_org: 'LH',
        application_type_raw: '행복주택',
        eligibility_rules_raw: '무주택세대구성원, 도시근로자 월평균소득 70% 이하',
      },
      {
        announcement_id: 'LH-2026-MR-2',
        source_org: 'LH',
        application_type_raw: '신유형주택',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 70% 이하, 총자산 2억 이하',
      },
      {
        announcement_id: 'XX-2026-MR-3',
        application_type_raw: '행복주택',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
      {
        announcement_id: 'SH-2026-MR-4',
        source_org: 'SH',
        application_type_raw: '행복주택',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  const reviewItems = matchedItems.filter((item) => item.grade === '검토필요');
  const reviewReasons = reviewItems.flatMap((item) =>
    item.reasons.filter((reason) => reason.startsWith('REVIEW_')),
  );
  const byCategory = reviewReasons.reduce<Record<string, number>>((acc, reason) => {
    const category = classifyMatcherReviewReason(reason);
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  assert.equal(reviewItems.length, 3);
  assert.equal(reviewReasons.length, 3);
  assert.equal(byCategory.missing_requirement, 1);
  assert.equal(byCategory.unknown_or_ambiguity, 1);
  assert.equal(byCategory.parser_cap, 1);
  assert.equal(byCategory.parser_cap / reviewReasons.length, 1 / 3);
});

test('match regression: 정상 케이스는 유력으로 유지되어 불필요한 검토필요를 방지한다', () => {
  const [matched] = match(
    parse([
      {
        announcement_id: 'SH-2026-MREG-1',
        source_org: 'SH',
        application_type_raw: '행복주택',
        eligibility_rules_raw:
          '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
      },
    ]),
  );

  assert.equal(matched.judgement_grade_cap, '확정 가능');
  assert.equal(matched.grade, '유력');
  assert.deepEqual(matched.reasons, ['INITIAL_RULE_MATCH: conservative-pass']);
});
