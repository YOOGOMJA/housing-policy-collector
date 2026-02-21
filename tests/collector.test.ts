import assert from 'node:assert/strict';
import test from 'node:test';

import { collect } from '../src/collector/index.js';

const createFetchResponse = (status: number, body: string): Response => {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
};

test('collect: 최근 N건 제한과 정규화 필드 매핑이 동작한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createFetchResponse(
      200,
      `
      <table>
        <tr>
          <td>1</td>
          <td><a href="/notice/1">2026-001 1차 행복주택 입주자 모집</a></td>
          <td>2026.03.01</td>
        </tr>
        <tr>
          <td>2</td>
          <td><a href="/notice/2">2026-002 2차 행복주택 입주자 모집</a></td>
          <td>2026.03.05</td>
        </tr>
      </table>
      `,
    );

  try {
    const result = await collect({ recentLimit: 1 });

    assert.equal(result.error, null);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      announcement_id: 'SH-2026-001-1',
      title: '2026-001 1차 행복주택 입주자 모집',
      detail_url:
        'https://www.i-sh.co.kr/notice/1',
      posted_at: '2026-03-01',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collect: 상태 코드 실패를 BAD_STATUS_CODE로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => createFetchResponse(503, 'service unavailable');

  try {
    const result = await collect();
    assert.equal(result.error?.code, 'BAD_STATUS_CODE');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collect: 파싱 실패를 PARSE_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createFetchResponse(200, '<table><tr><td>no link row</td></tr></table>');

  try {
    const result = await collect();
    assert.equal(result.error?.code, 'PARSE_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collect: 네트워크 오류를 NETWORK_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('socket hang up');
  };

  try {
    const result = await collect();
    assert.equal(result.error?.code, 'NETWORK_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
