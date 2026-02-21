import assert from "node:assert/strict";
import test from "node:test";

import { runPipeline } from "../src/main.js";
import {
  getRecentAcceptanceRuntimeMetrics,
  resetStorageAdapter,
} from "../src/storage/index.js";

test("runPipeline: acceptance 런타임 지표는 SH 기준으로만 집계한다", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("i-sh.co.kr")) {
      return new Response(
        `
          <table>
            <tr>
              <td>1</td>
              <td><a href="">2026-010 SH 청년주택 모집</a></td>
              <td></td>
            </tr>
          </table>
        `,
        { status: 200 },
      );
    }

    if (url.includes("apply.lh.or.kr")) {
      return new Response(
        `
          <table>
            <tr>
              <td>1</td>
              <td><a href="/notice/99">2026-010 LH 행복주택 모집</a></td>
              <td>2026.04.01</td>
            </tr>
          </table>
        `,
        { status: 200 },
      );
    }

    throw new Error(`unexpected url: ${url}`);
  };

  resetStorageAdapter();

  try {
    const result = await runPipeline();

    assert.equal(result.collected, 2);

    const [runtimeMetric] = getRecentAcceptanceRuntimeMetrics(1);
    assert.equal(runtimeMetric.collected_success_count, 1);
    assert.equal(runtimeMetric.required_fields_complete_count, 0);
    assert.equal(runtimeMetric.review_needed_count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetStorageAdapter();
  }
});
