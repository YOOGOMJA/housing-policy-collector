/**
 * POC acceptance evaluator.
 *
 * 기준 문서: docs/00-product/03-scope-release-plan.md
 */

export const ACCEPTANCE_BATCH_RUN_COUNT = 5;
export const SH_RECENT_TARGET_COUNT = 50;

export type AcceptanceBatchSample = {
  runId: string;
  shRecentTargetCount: number;
  collectedSuccessCount: number;
  requiredFieldsCompleteCount: number;
  reviewNeededCount: number;
};

export type AcceptanceMetricSnapshot = {
  collectionSuccessRate: number;
  requiredFieldExtractionRate: number;
  reviewNeededBranchRate: number;
};

export type AcceptanceEvaluationResult = {
  pass: boolean;
  failures: string[];
  snapshots: AcceptanceMetricSnapshot[];
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

const toRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

const buildFailureMessage = (params: {
  metric: '수집 성공률' | '필수 필드 추출률' | '검토필요 분기율';
  runId: string;
  actual: number;
  threshold: string;
  formula: string;
}): string => {
  return [
    '[ACCEPTANCE_FAIL]',
    `run=${params.runId}`,
    `metric=${params.metric}`,
    `actual=${formatPercent(params.actual)}`,
    `threshold=${params.threshold}`,
    `formula=${params.formula}`,
  ].join(' ');
};

export const evaluateAcceptanceBatches = (
  samples: AcceptanceBatchSample[],
): AcceptanceEvaluationResult => {
  const failures: string[] = [];

  if (samples.length !== ACCEPTANCE_BATCH_RUN_COUNT) {
    failures.push(
      `[ACCEPTANCE_FAIL] metric=연속 배치 횟수 actual=${samples.length}회 threshold=${ACCEPTANCE_BATCH_RUN_COUNT}회 formula=연속 5회 배치 실행`,
    );

    return {
      pass: false,
      failures,
      snapshots: [],
    };
  }

  const snapshots = samples.map((sample) => {
    const collectionSuccessRate = toRate(sample.collectedSuccessCount, sample.shRecentTargetCount);
    const requiredFieldExtractionRate = toRate(
      sample.requiredFieldsCompleteCount,
      sample.collectedSuccessCount,
    );
    const reviewNeededBranchRate = toRate(sample.reviewNeededCount, sample.collectedSuccessCount);

    if (collectionSuccessRate < 0.95) {
      failures.push(
        buildFailureMessage({
          metric: '수집 성공률',
          runId: sample.runId,
          actual: collectionSuccessRate,
          threshold: '>=95.00%',
          formula: '수집 성공 건수 / SH 최근 N(50)건',
        }),
      );
    }

    if (requiredFieldExtractionRate < 0.98) {
      failures.push(
        buildFailureMessage({
          metric: '필수 필드 추출률',
          runId: sample.runId,
          actual: requiredFieldExtractionRate,
          threshold: '>=98.00%',
          formula: '필수 필드 4개 완비 건수 / 수집 성공 건수',
        }),
      );
    }

    if (reviewNeededBranchRate > 0.15) {
      failures.push(
        buildFailureMessage({
          metric: '검토필요 분기율',
          runId: sample.runId,
          actual: reviewNeededBranchRate,
          threshold: '<=15.00%',
          formula: '검토필요 분류 건수 / 수집 성공 건수',
        }),
      );
    }

    return {
      collectionSuccessRate,
      requiredFieldExtractionRate,
      reviewNeededBranchRate,
    };
  });

  return {
    pass: failures.length === 0,
    failures,
    snapshots,
  };
};
