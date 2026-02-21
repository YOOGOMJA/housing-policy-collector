/** 배치 실행용 엔트리포인트. */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveUserProfileFromArgs, runPipeline } from "./main.js";
import {
  buildAcceptanceSamplesFromRepository,
  evaluateAcceptanceBatches,
} from "./metrics/acceptance.js";
import { getRecentAcceptanceRuntimeMetrics } from "./storage/index.js";

export const main = async (): Promise<void> => {
  const startedAt = new Date().toISOString();
  const profile = await resolveUserProfileFromArgs(process.argv);
  const result = await runPipeline(profile);

  const acceptanceSamples = buildAcceptanceSamplesFromRepository({
    getRecentAcceptanceRuntimeMetrics: (limit) => {
      return getRecentAcceptanceRuntimeMetrics(limit).map((record) => ({
        runId: record.run_id,
        collectedSuccessCount: record.collected_success_count,
        requiredFieldsCompleteCount: record.required_fields_complete_count,
        reviewNeededCount: record.review_needed_count,
      }));
    },
  });
  const acceptance = evaluateAcceptanceBatches(acceptanceSamples);

  console.log(
    JSON.stringify({
      event: "batch.completed",
      startedAt,
      pipeline: result,
      acceptance: {
        status: acceptance.pass ? "PASS" : "FAIL",
        failures: acceptance.failures,
      },
    }),
  );
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main();
}
