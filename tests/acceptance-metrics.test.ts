import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ACCEPTANCE_BATCH_RUN_COUNT,
  ACCEPTANCE_REVIEW_NEEDED_RATIO_DATASET,
  ACCEPTANCE_REVIEW_NEEDED_RATIO_THRESHOLD,
  buildAcceptanceSamplesFromRepository,
  buildAcceptanceSamplesFromReviewDataset,
  evaluateAcceptanceBatches,
  SH_RECENT_TARGET_COUNT,
} from "../src/metrics/acceptance.js";
import {
  getRecentAcceptanceRuntimeMetrics,
  resetStorageAdapter,
  saveAcceptanceRuntimeMetrics,
  setSQLiteStorageAdapter,
} from "../src/storage/index.js";

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

test("acceptance evaluator: 5회 연속 기준 충족 시 PASS를 반환한다", () => {
  const result = evaluateAcceptanceBatches(createPassingSamples());

  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.snapshots.length, ACCEPTANCE_BATCH_RUN_COUNT);
});

test("acceptance evaluator: 기준 미달 지표를 수치와 함께 표준 메시지로 반환한다", () => {
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

test("acceptance evaluator: 수집 성공률 분모는 SH 최근 50건으로 고정 계산한다", () => {
  const samples = createPassingSamples();

  samples[0] = {
    ...samples[0],
    shRecentTargetCount: 40,
    collectedSuccessCount: 39,
  };

  const result = evaluateAcceptanceBatches(samples);

  assert.equal(result.pass, false);
  assert.match(
    result.failures[0],
    /^\[ACCEPTANCE_FAIL\] run=batch-1 metric=수집 성공률 분모 actual=40건 threshold=50건 formula=SH 최근 N\(50\)건 고정$/,
  );
  assert.match(
    result.failures[1],
    /^\[ACCEPTANCE_FAIL\] run=batch-1 metric=수집 성공률 actual=78\.00% threshold=>=95\.00% formula=수집 성공 건수 \/ SH 최근 N\(50\)건$/,
  );
});

test("acceptance evaluator: 검토필요 비율 임계치(<=15%) 데이터셋을 acceptance evaluator에 연결한다", () => {
  const samples = buildAcceptanceSamplesFromReviewDataset(
    ACCEPTANCE_REVIEW_NEEDED_RATIO_DATASET,
  );
  const result = evaluateAcceptanceBatches(samples);

  assert.equal(samples.length, ACCEPTANCE_BATCH_RUN_COUNT);
  assert.equal(result.pass, true);

  for (const snapshot of result.snapshots) {
    assert.equal(
      snapshot.reviewNeededBranchRate <=
        ACCEPTANCE_REVIEW_NEEDED_RATIO_THRESHOLD,
      true,
    );
  }
});

test("acceptance evaluator: 저장소 최근 5회 레코드를 acceptance 샘플로 변환한다", () => {
  const repository = {
    getRecentAcceptanceRuntimeMetrics: (limit: number) => {
      assert.equal(limit, ACCEPTANCE_BATCH_RUN_COUNT);

      return Array.from({ length: ACCEPTANCE_BATCH_RUN_COUNT }, (_, index) => ({
        runId: `recent-run-${index + 1}`,
        collectedSuccessCount: 49,
        requiredFieldsCompleteCount: 49,
        reviewNeededCount: 7,
      }));
    },
  };

  const samples = buildAcceptanceSamplesFromRepository(repository);

  assert.equal(samples.length, ACCEPTANCE_BATCH_RUN_COUNT);
  assert.deepEqual(samples[0], {
    runId: "recent-run-1",
    shRecentTargetCount: SH_RECENT_TARGET_COUNT,
    collectedSuccessCount: 49,
    requiredFieldsCompleteCount: 49,
    reviewNeededCount: 7,
  });
});

test("acceptance evaluator: 저장소 집계 경로로 최근 5회 실행을 자동 평가한다", async () => {
  const dbPath = join(
    tmpdir(),
    `housing-policy-collector-acceptance-${process.pid}-${Date.now()}.sqlite`,
  );

  try {
    setSQLiteStorageAdapter(dbPath);

    for (let index = 0; index < ACCEPTANCE_BATCH_RUN_COUNT; index += 1) {
      saveAcceptanceRuntimeMetrics({
        run_id: `run-${index + 1}`,
        collected_success_count: 49,
        required_fields_complete_count: 49,
        review_needed_count: 7,
      });
    }

    const samples = buildAcceptanceSamplesFromRepository({
      getRecentAcceptanceRuntimeMetrics: (limit) => {
        return getRecentAcceptanceRuntimeMetrics(limit).map((record) => ({
          runId: record.run_id,
          collectedSuccessCount: record.collected_success_count,
          requiredFieldsCompleteCount: record.required_fields_complete_count,
          reviewNeededCount: record.review_needed_count,
        }));
      },
    });
    const result = evaluateAcceptanceBatches(samples);

    assert.equal(samples.length, ACCEPTANCE_BATCH_RUN_COUNT);
    assert.equal(result.pass, true);
    assert.deepEqual(result.failures, []);
  } finally {
    resetStorageAdapter();
    await unlink(dbPath).catch(() => undefined);
  }
});
