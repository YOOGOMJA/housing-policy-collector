import assert from 'node:assert/strict';
import test from 'node:test';

import { parse } from '../src/parser/index.js';

test('parse: application_type을 정책 enum으로 정규화한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'SH-2026-001-1',
      source_org: 'SH',
      application_type_raw: '행복주택(공공임대)',
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하',
    },
  ]);

  assert.equal(parsed.application_type, 'PUBLIC_RENTAL');
  assert.equal(parsed.judgement_grade_cap, '확정 가능');
  assert.equal(parsed.region_requirement, '서울시 거주');
  assert.equal(parsed.household_requirement, '무주택세대구성원');
  assert.equal(parsed.income_requirement, '도시근로자 월평균소득 100% 이하');
  assert.equal(parsed.asset_requirement, '총자산 3억 6,100만원 이하');
  assert.equal(parsed.log.failure_reason, null);
});

test('parse: 필수 필드 누락 시 judgement_grade_cap을 검토필요로 제한한다', () => {
  const [parsed] = parse([
    {
      announcement_id: 'LH-2026-77-1',
      source_org: 'LH',
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
      eligibility_rules_raw:
        '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하',
    },
  ]);

  assert.equal(parsed.application_type_raw, '행복주택');
  assert.equal(parsed.application_type, 'PUBLIC_RENTAL');
  assert.equal(parsed.judgement_grade_cap, '확정 가능');
});
