/** 애플리케이션 시작점. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collect } from './collector/index.js';
import { match } from './matcher/index.js';
import { notify } from './notifier/index.js';
import { parse } from './parser/index.js';
import { save } from './storage/index.js';

export type PipelineResult = {
  collected: number;
  parsed: number;
  saved: number;
  notified: number;
};

export const runPipeline = async (): Promise<PipelineResult> => {
  const collectResult = await collect();
  const parsedItems = parse(
    collectResult.items.map((item) => item.announcement_id),
  );
  const matchedItems = match(parsedItems);
  const savedCount = save(matchedItems);
  const notifiedCount = notify(matchedItems);

  if (collectResult.error !== null) {
    console.warn(
      `collector warning(${collectResult.error.code}): ${collectResult.error.message}`,
    );
  }

  return {
    collected: collectResult.items.length,
    parsed: parsedItems.length,
    saved: savedCount,
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
