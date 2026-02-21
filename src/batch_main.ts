/** 배치 실행용 엔트리포인트. */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveUserProfileFromArgs, runPipeline } from './main.js';

export const main = async (): Promise<void> => {
  const startedAt = new Date().toISOString();
  const profile = await resolveUserProfileFromArgs(process.argv);
  const result = await runPipeline(profile);
  console.log(`batch executed at ${startedAt}: ${JSON.stringify(result)}`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main();
}
