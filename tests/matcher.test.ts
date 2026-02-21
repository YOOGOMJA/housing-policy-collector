import assert from 'node:assert/strict';
import test from 'node:test';

import { match } from '../src/matcher/index.js';
import { parse } from '../src/parser/index.js';

test('match: 법적 필수 조건 위배가 명확하면 부적합으로 즉시 판정한다', () => {
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

  assert.equal(matched.grade, '부적합');
  assert.deepEqual(matched.reasons, ['LEGAL_REQUIREMENT_VIOLATION: household_requirement']);
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
