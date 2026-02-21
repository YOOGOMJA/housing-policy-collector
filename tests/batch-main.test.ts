import assert from 'node:assert/strict';
import test from 'node:test';

import { main as batchMain } from '../src/batch_main.js';
import { resetStorageAdapter } from '../src/storage/index.js';

test('batch_main: 예상 액션(수집/파싱/저장/알림 수량 로그)을 출력한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;

  const logs: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes('i-sh.co.kr')) {
      return new Response(
        `
        <table>
          <tr>
            <td>1</td>
            <td><a href="/notice/10">2026-010 1차 청년주택 모집</a></td>
            <td>2026.04.01</td>
          </tr>
        </table>
        `,
        { status: 200 },
      );
    }

    throw new Error('lh fetch failed');
  };

  console.log = (message?: unknown): void => {
    logs.push(String(message));
  };

  resetStorageAdapter();

  try {
    await batchMain();
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }

  assert.ok(logs.length >= 1);
  const batchLog = logs.find((entry) => /batch executed at/.test(entry));
  assert.ok(batchLog !== undefined);
  assert.match(
    batchLog,
    /"collected":1,"parsed":1,"saved":\{"created":1,"updated":0,"skipped":0\},"notified":1/,
  );
});
