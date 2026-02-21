/** 애플리케이션 시작점. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DownstreamAnnouncementInput } from './collector/index.js';
import { collect } from './collector/index.js';
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

export const runPipeline = async (): Promise<PipelineResult> => {
  const collectResult = await collect();
  const parseInputItems: DownstreamAnnouncementInput[] = collectResult.items.map((item) => ({
    announcement_id: item.announcement_id,
    title: item.title,
    detail_url: item.detail_url,
    posted_at: item.posted_at,
    source_org: 'SH',
  }));

  const parsedItems = parse(
    parseInputItems,
  );
  const matchedItems = match(parsedItems);
  const savedResult = save(matchedItems);
  const notifiedCount = notify(matchedItems);

  if (collectResult.error !== null) {
    console.warn(
      `collector warning(${collectResult.error.code}): ${collectResult.error.message}`,
    );
  }

  return {
    collected: collectResult.items.length,
    parsed: parsedItems.length,
    saved: savedResult,
    notified: notifiedCount,
  };
};

export const main = async (): Promise<void> => {
  const result = await runPipeline();
  console.log(`app started: ${JSON.stringify(result)}`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main();
}
