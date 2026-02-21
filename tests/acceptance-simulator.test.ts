import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCEPTANCE_BATCH_RUN_COUNT,
  type AcceptanceBatchSample,
  evaluateAcceptanceBatches,
  SH_RECENT_TARGET_COUNT,
} from '../src/metrics/acceptance.js';

const createSamples = (
  overridesByIndex: Record<number, Partial<AcceptanceBatchSample>> = {},
): AcceptanceBatchSample[] => {
  return Array.from({ length: ACCEPTANCE_BATCH_RUN_COUNT }, (_, index) => ({
    runId: `run-${index + 1}`,
    shRecentTargetCount: SH_RECENT_TARGET_COUNT,
    collectedSuccessCount: 49,
    requiredFieldsCompleteCount: 49,
    reviewNeededCount: 7,
    ...overridesByIndex[index],
  }));
};

test('acceptance simulator: 5회 결과가 모두 기준 충족이면 PASS', () => {
  const result = evaluateAcceptanceBatches(createSamples());

  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.snapshots.length, ACCEPTANCE_BATCH_RUN_COUNT);

  for (const snapshot of result.snapshots) {
    assert.equal(snapshot.collectionSuccessRate >= 0.95, true);
    assert.equal(snapshot.requiredFieldExtractionRate >= 0.98, true);
    assert.equal(snapshot.reviewNeededBranchRate <= 0.15, true);
  }
});

test('acceptance simulator: 1회라도 기준 미달이면 전체 FAIL', () => {
  const result = evaluateAcceptanceBatches(
    createSamples({
      2: {
        collectedSuccessCount: 47,
        requiredFieldsCompleteCount: 45,
        reviewNeededCount: 8,
      },
    }),
  );

  assert.equal(result.pass, false);
  assert.equal(result.failures.length, 3);
  assert.equal(result.failures.every((failure) => failure.includes('run=run-3')), true);

  assert.equal(result.snapshots[2]?.collectionSuccessRate, 47 / SH_RECENT_TARGET_COUNT);
  assert.equal(result.snapshots[2]?.requiredFieldExtractionRate, 45 / 47);
  assert.equal(result.snapshots[2]?.reviewNeededBranchRate, 8 / 47);
});

test('acceptance simulator: 경계값(95%, 98%, 15%)은 정확히 PASS로 판정', () => {
  const result = evaluateAcceptanceBatches(
    createSamples({
      0: {
        collectedSuccessCount: 47.5,
        requiredFieldsCompleteCount: 46.55,
        reviewNeededCount: 7.125,
      },
    }),
  );

  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.snapshots[0]?.collectionSuccessRate, 0.95);
  assert.equal(result.snapshots[0]?.requiredFieldExtractionRate, 0.98);
  assert.equal(result.snapshots[0]?.reviewNeededBranchRate, 0.15);
});
