import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCEPTANCE_BATCH_RUN_COUNT,
  evaluateAcceptanceBatches,
  SH_RECENT_TARGET_COUNT,
} from '../src/metrics/acceptance.js';

const createPassingSamples = (): Array<{
  runId: string;
  shRecentTargetCount: number;
  collectedSuccessCount: number;
  requiredFieldsCompleteCount: number;
  reviewNeededCount: number;
}> => {
  return Array.from({ length: ACCEPTANCE_BATCH_RUN_COUNT }, (_, index) => ({
    runId: `batch-${index + 1}`,
    shRecentTargetCount: SH_RECENT_TARGET_COUNT,
    collectedSuccessCount: 49,
    requiredFieldsCompleteCount: 49,
    reviewNeededCount: 7,
  }));
};

test('acceptance evaluator: 5회 연속 기준 충족 시 PASS를 반환한다', () => {
  const result = evaluateAcceptanceBatches(createPassingSamples());

  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.snapshots.length, ACCEPTANCE_BATCH_RUN_COUNT);
});

test('acceptance evaluator: 기준 미달 지표를 수치와 함께 표준 메시지로 반환한다', () => {
  const samples = createPassingSamples();

  samples[2] = {
    ...samples[2],
    collectedSuccessCount: 47,
    requiredFieldsCompleteCount: 45,
    reviewNeededCount: 8,
  };

  const result = evaluateAcceptanceBatches(samples);

  assert.equal(result.pass, false);
  assert.equal(result.failures.length, 3);
  assert.match(
    result.failures[0],
    /^\[ACCEPTANCE_FAIL\] run=batch-3 metric=수집 성공률 actual=94\.00% threshold=>=95\.00% formula=수집 성공 건수 \/ SH 최근 N\(50\)건$/,
  );
  assert.match(
    result.failures[1],
    /^\[ACCEPTANCE_FAIL\] run=batch-3 metric=필수 필드 추출률 actual=95\.74% threshold=>=98\.00% formula=필수 필드 4개 완비 건수 \/ 수집 성공 건수$/,
  );
  assert.match(
    result.failures[2],
    /^\[ACCEPTANCE_FAIL\] run=batch-3 metric=검토필요 분기율 actual=17\.02% threshold=<=15\.00% formula=검토필요 분류 건수 \/ 수집 성공 건수$/,
  );
});
