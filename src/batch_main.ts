/** 배치 실행용 엔트리포인트. */

import { runPipeline } from './main.js';

export const main = (): void => {
  const startedAt = new Date().toISOString();
  const result = runPipeline();
  console.log(`batch executed at ${startedAt}: ${JSON.stringify(result)}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
