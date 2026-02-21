/** 애플리케이션 시작점. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DownstreamAnnouncementInput } from './collector/index.js';
import { collectAll } from './collector/index.js';
import type { UserProfile } from './matcher/index.js';
import { match } from './matcher/index.js';
import { notify } from './notifier/index.js';
import { parse } from './parser/index.js';
import { save } from './storage/index.js';

/** 런타임 파이프라인 결과. (테스트용 acceptance 집계는 src/metrics/acceptance.ts에서 분리 관리) */
export type PipelineResult = {
  collected: number;
  parsed: number;
  saved: {
    created: number;
    updated: number;
    skipped: number;
  };
  notified: number;
};

const parseUserProfile = (raw: string): UserProfile => {
  const parsed = JSON.parse(raw) as Partial<UserProfile>;

  if (
    typeof parsed.region !== 'string' ||
    typeof parsed.incomeBand !== 'string' ||
    typeof parsed.assetBand !== 'string' ||
    typeof parsed.householdType !== 'string'
  ) {
    throw new Error('invalid UserProfile: region/incomeBand/assetBand/householdType must be string');
  }

  return {
    region: parsed.region,
    incomeBand: parsed.incomeBand,
    assetBand: parsed.assetBand,
    householdType: parsed.householdType,
  };
};

export const resolveUserProfileFromArgs = async (
  argv: string[] = process.argv,
): Promise<UserProfile | undefined> => {
  const profileJsonArgIndex = argv.indexOf('--profile-json');
  if (profileJsonArgIndex >= 0 && argv[profileJsonArgIndex + 1] !== undefined) {
    return parseUserProfile(argv[profileJsonArgIndex + 1]);
  }

  const profileFileArgIndex = argv.indexOf('--profile-file');
  if (profileFileArgIndex >= 0 && argv[profileFileArgIndex + 1] !== undefined) {
    const filePath = resolve(argv[profileFileArgIndex + 1]);
    const fileContent = await readFile(filePath, 'utf8');
    return parseUserProfile(fileContent);
  }

  return undefined;
};

export const runPipeline = async (profile?: UserProfile): Promise<PipelineResult> => {
  const collectResult = await collectAll();
  const parseInputItems: DownstreamAnnouncementInput[] = Object.values(collectResult.by_org).flatMap(
    (orgResult) => orgResult.items,
  );

  const parsedItems = parse(
    parseInputItems,
  );
  const matchedItems = match(parsedItems, profile);
  const savedResult = save(matchedItems);
  const notifiedCount = notify(matchedItems);

  for (const orgResult of Object.values(collectResult.by_org)) {
    if (orgResult.error !== null) {
      console.warn(`collector warning(${orgResult.error.code}): ${orgResult.error.message}`);
    }
  }

  return {
    collected: collectResult.items.length,
    parsed: parsedItems.length,
    saved: savedResult,
    notified: notifiedCount,
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
