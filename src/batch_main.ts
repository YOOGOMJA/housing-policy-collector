/** 배치 실행용 엔트리포인트. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from './main.js';

export const main = async (): Promise<void> => {
  const startedAt = new Date().toISOString();
  const result = await runPipeline();
  console.log(`batch executed at ${startedAt}: ${JSON.stringify(result)}`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main();
}
