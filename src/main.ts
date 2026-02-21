/** 애플리케이션 시작점. */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DownstreamAnnouncementInput } from "./collector/index.js";
import { collectAll } from "./collector/index.js";
import type { UserProfile } from "./matcher/index.js";
import { match } from "./matcher/index.js";
import { notify } from "./notifier/index.js";
import { parse } from "./parser/index.js";
import {
  save,
  saveAcceptanceRuntimeMetrics,
  saveBatchRunHistory,
} from "./storage/index.js";

/** 런타임 파이프라인 결과. (테스트용 acceptance 집계는 src/metrics/acceptance.ts에서 분리 관리) */
export type PipelineResult = {
  runId: string;
  collected: number;
  parsed: number;
  matched: number;
  saved: {
    created: number;
    updated: number;
    skipped: number;
  };
  notified: number;
};

const hasRequiredFieldsComplete = (item: {
  region_requirement: string | null;
  household_requirement: string | null;
  income_requirement: string | null;
  asset_requirement: string | null;
}): boolean => {
  return (
    item.region_requirement !== null &&
    item.household_requirement !== null &&
    item.income_requirement !== null &&
    item.asset_requirement !== null
  );
};

const parseNonEmptyProfileField = (
  value: unknown,
  fieldName: keyof UserProfile,
): string => {
  if (typeof value !== "string") {
    throw new Error(
      `invalid UserProfile: ${fieldName} must be non-empty string`,
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(
      `invalid UserProfile: ${fieldName} must be non-empty string`,
    );
  }

  return normalized;
};

const parseUserProfile = (raw: string): UserProfile => {
  const parsed = JSON.parse(raw) as Partial<UserProfile>;

  return {
    region: parseNonEmptyProfileField(parsed.region, "region"),
    incomeBand: parseNonEmptyProfileField(parsed.incomeBand, "incomeBand"),
    assetBand: parseNonEmptyProfileField(parsed.assetBand, "assetBand"),
    householdType: parseNonEmptyProfileField(
      parsed.householdType,
      "householdType",
    ),
  };
};

export const resolveUserProfileFromArgs = async (
  argv: string[] = process.argv,
): Promise<UserProfile | undefined> => {
  const profileJsonArgIndex = argv.indexOf("--profile-json");
  if (profileJsonArgIndex >= 0 && argv[profileJsonArgIndex + 1] !== undefined) {
    return parseUserProfile(argv[profileJsonArgIndex + 1]);
  }

  const profileFileArgIndex = argv.indexOf("--profile-file");
  if (profileFileArgIndex >= 0 && argv[profileFileArgIndex + 1] !== undefined) {
    const filePath = resolve(argv[profileFileArgIndex + 1]);
    const fileContent = await readFile(filePath, "utf8");
    return parseUserProfile(fileContent);
  }

  return undefined;
};

export const runPipeline = async (
  profile?: UserProfile,
): Promise<PipelineResult> => {
  const runId = randomUUID();
  const collectResult = await collectAll();
  const parseInputItems: DownstreamAnnouncementInput[] = Object.values(
    collectResult.by_org,
  ).flatMap((orgResult) => orgResult.items);

  const parsedItems = parse(parseInputItems);
  const matchedItems = match(parsedItems, profile);
  const savedResult = save(matchedItems);
  const profileId =
    profile === undefined
      ? "anonymous-profile"
      : `${profile.region}|${profile.incomeBand}|${profile.assetBand}|${profile.householdType}`;
  const notifiedCount = await notify(matchedItems, { profileId });

  for (const orgResult of Object.values(collectResult.by_org)) {
    if (orgResult.error !== null) {
      console.warn(
        `collector warning(${orgResult.error.code}): ${orgResult.error.message}`,
      );
    }
  }

  saveBatchRunHistory({
    run_id: runId,
    profile_id: profileId,
    collected_count: collectResult.items.length,
    parsed_count: parsedItems.length,
    matched_count: matchedItems.length,
    notified_count: notifiedCount,
    saved_created_count: savedResult.created,
    saved_updated_count: savedResult.updated,
    saved_skipped_count: savedResult.skipped,
  });

  const requiredFieldsCompleteCount = matchedItems.filter((item) => {
    return hasRequiredFieldsComplete(item);
  }).length;
  const reviewNeededCount = matchedItems.filter((item) => {
    return item.grade === "검토필요";
  }).length;

  saveAcceptanceRuntimeMetrics({
    run_id: runId,
    collected_success_count: collectResult.items.length,
    required_fields_complete_count: requiredFieldsCompleteCount,
    review_needed_count: reviewNeededCount,
  });

  return {
    runId,
    collected: collectResult.items.length,
    parsed: parsedItems.length,
    saved: savedResult,
    notified: notifiedCount,
    matched: matchedItems.length,
  };
};

export const main = async (): Promise<void> => {
  const profile = await resolveUserProfileFromArgs(process.argv);
  const result = await runPipeline(profile);
  console.log(`app started: ${JSON.stringify(result)}`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main();
}
