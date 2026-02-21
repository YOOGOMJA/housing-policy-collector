import assert from 'node:assert/strict';
import test from 'node:test';

import { main as batchMain } from '../src/batch_main.js';

test('batch_main: 예상 액션(수집/파싱/저장/알림 수량 로그)을 출력한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;

  const logs: string[] = [];

  globalThis.fetch = async () =>
    new Response(
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

  console.log = (message?: unknown): void => {
    logs.push(String(message));
  };

  try {
    await batchMain();
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }

  assert.equal(logs.length, 1);
  assert.match(logs[0], /batch executed at/);
  assert.match(
    logs[0],
    /"collected":1,"parsed":1,"saved":1,"notified":1/,
  );
});
