import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { MatchedItem } from "../src/matcher/index.js";
import { notify } from "../src/notifier/index.js";
import {
  resetStorageAdapter,
  save,
  setSQLiteStorageAdapter,
} from "../src/storage/index.js";

const createMatchedItem = (
  overrides: Partial<MatchedItem> = {},
): MatchedItem => {
  return {
    sourceId: "source-1",
    title: "2026-001 1차 행복주택 모집",
    source_org: "SH",
    announcement_id: "SH-2026-001-1",
    application_type_raw: "행복주택",
    application_type: "PUBLIC_RENTAL",
    eligibility_rules_raw:
      "서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하",
    region_requirement: "서울시 거주",
    household_requirement: "무주택세대구성원",
    income_requirement: "도시근로자 월평균소득 100% 이하",
    asset_requirement: "총자산 3억 이하",
    judgement_grade_cap: "확정 가능",
    log: {
      trace_id: "trace-1",
      failure_reason: null,
      source_snapshot_ref: "snapshot://sh/2026-001-v1",
      metadata: {
        failure_reasons: [],
        ambiguous_fragments: [],
      },
    },
    grade: "유력",
    reasons: ["INITIAL_RULE_MATCH: conservative-pass"],
    ...overrides,
  };
};

const createSqlitePath = (suffix: string): string => {
  return join(
    tmpdir(),
    `housing-policy-collector-${process.pid}-${Date.now()}-${suffix}.sqlite`,
  );
};

test("save(SQLite): 영속 데이터는 adapter 재생성 이후에도 skipped로 집계한다", async () => {
  const dbPath = createSqlitePath("persistence");

  try {
    setSQLiteStorageAdapter(dbPath);
    const created = save([createMatchedItem()]);
    assert.deepEqual(created, {
      created: 1,
      updated: 0,
      skipped: 0,
    });

    setSQLiteStorageAdapter(dbPath);
    const skipped = save([createMatchedItem()]);

    assert.deepEqual(skipped, {
      created: 0,
      updated: 0,
      skipped: 1,
    });
  } finally {
    resetStorageAdapter();
    await unlink(dbPath).catch(() => undefined);
  }
});

test("save: 동일 announcement_id + 다른 hash는 updated로 집계한다", () => {
  resetStorageAdapter();

  const original = createMatchedItem();
  save([original]);

  const updated = createMatchedItem({
    title: "2026-001 1차 행복주택 모집(수정)",
    log: {
      ...original.log,
      source_snapshot_ref: "snapshot://sh/2026-001-v2",
    },
  });

  const result = save([updated]);

  assert.deepEqual(result, {
    created: 0,
    updated: 1,
    skipped: 0,
  });
});

test("save: 동일 announcement_id + 동일 hash는 skipped로 집계한다", () => {
  resetStorageAdapter();

  const item = createMatchedItem();
  save([item]);

  const result = save([createMatchedItem()]);

  assert.deepEqual(result, {
    created: 0,
    updated: 0,
    skipped: 1,
  });
});

test("save: 신규 announcement_id는 created로 집계한다", () => {
  resetStorageAdapter();

  const result = save([createMatchedItem()]);

  assert.deepEqual(result, {
    created: 1,
    updated: 0,
    skipped: 0,
  });
});

test("notify(SQLite): 동일 idempotency key는 중복 알림을 억제한다", async () => {
  const dbPath = createSqlitePath("notification");

  try {
    setSQLiteStorageAdapter(dbPath);

    const firstNotified = await notify([createMatchedItem()], {
      profileId: "seoul|middle|asset-mid|single",
    });
    const secondNotified = await notify([createMatchedItem()], {
      profileId: "seoul|middle|asset-mid|single",
    });

    assert.equal(firstNotified, 1);
    assert.equal(secondNotified, 0);
  } finally {
    resetStorageAdapter();
    await unlink(dbPath).catch(() => undefined);
  }
});
