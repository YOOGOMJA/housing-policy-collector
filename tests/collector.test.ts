import assert from 'node:assert/strict';
import test from 'node:test';

import { collectAll, collectLh, collectSh } from '../src/collector/index.js';

const isCompleteRequiredField = (item: {
  title: string;
  source_org: 'SH' | 'LH';
  posted_at: string;
  detail_url: string;
}): boolean => {
  return [item.title, item.source_org, item.posted_at, item.detail_url].every(
    (value) => value.trim().length > 0,
  );
};

const createFetchResponse = (status: number, body: string): Response => {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
};

test('collectSh: 최근 N건 제한과 정규화 필드 매핑이 동작한다', async () => {
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
    const result = await collectSh({ recentLimit: 1 });

    assert.equal(result.error, null);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      source_org: 'SH',
      announcement_id: 'SH-2026-001-1',
      title: '2026-001 1차 행복주택 입주자 모집',
      detail_url: 'https://www.i-sh.co.kr/notice/1',
      posted_at: '2026-03-01',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectSh: 상태 코드 실패를 BAD_STATUS_CODE로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => createFetchResponse(503, 'service unavailable');

  try {
    const result = await collectSh();
    assert.equal(result.error?.code, 'BAD_STATUS_CODE');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectSh: 파싱 실패를 PARSE_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createFetchResponse(200, '<table><tr><td>no link row</td></tr></table>');

  try {
    const result = await collectSh();
    assert.equal(result.error?.code, 'PARSE_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectSh: 네트워크 오류를 NETWORK_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('socket hang up');
  };

  try {
    const result = await collectSh();
    assert.equal(result.error?.code, 'NETWORK_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectSh fixture: 필수 필드 추출률 분자/분모 계산이 가능하다', async () => {
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
          <td><a href="">2026-002 2차 행복주택 입주자 모집</a></td>
          <td></td>
        </tr>
      </table>
      `,
    );

  try {
    const result = await collectSh({ recentLimit: 2 });

    const denominator = result.items.length;
    const numerator = result.items.filter((item) => isCompleteRequiredField(item)).length;

    assert.equal(denominator, 2);
    assert.equal(numerator, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const lhFixtureHtml = `
<table>
  <tr>
    <td>1</td>
    <td><a href="/lh/notice/10">2026-020 1차 매입임대 예비입주자 모집</a></td>
    <td>2026.04.01</td>
  </tr>
  <tr>
    <td>2</td>
    <td><a href="/lh/notice/11">2026-021 2차 전세임대 모집</a></td>
    <td>2026.04.03</td>
  </tr>
</table>
`;

test('collectLh fixture: 정상 케이스에서 LH 공고를 파싱한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => createFetchResponse(200, lhFixtureHtml);

  try {
    const result = await collectLh({ recentLimit: 1 });

    assert.equal(result.error, null);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      source_org: 'LH',
      announcement_id: 'LH-2026-020-01',
      title: '2026-020 1차 매입임대 예비입주자 모집',
      detail_url: 'https://apply.lh.or.kr/lh/notice/10',
      posted_at: '2026-04-01',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});



test('collectLh fixture: 중간 행 스킵이 있어도 announcement_id 행순번을 유지한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createFetchResponse(
      200,
      `
      <table>
        <tr>
          <td>1</td>
          <td><a href="/lh/notice/20">2026-030 1차 공고</a></td>
          <td>2026.05.01</td>
        </tr>
        <tr>
          <td>2</td>
          <td>링크 누락 행</td>
          <td>2026.05.02</td>
        </tr>
        <tr>
          <td>3</td>
          <td><a href="/lh/notice/22">2026-032 1차 공고</a></td>
          <td>2026.05.03</td>
        </tr>
      </table>
      `,
    );

  try {
    const result = await collectLh({ recentLimit: 3 });

    assert.equal(result.error, null);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.announcement_id, 'LH-2026-030-01');
    assert.equal(result.items[1]?.announcement_id, 'LH-2026-032-03');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectLh fixture: 파싱 실패 케이스를 PARSE_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    createFetchResponse(200, '<table><tr><td>링크 없음</td></tr></table>');

  try {
    const result = await collectLh();
    assert.equal(result.error?.code, 'PARSE_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectLh fixture: 네트워크 실패 케이스를 NETWORK_ERROR로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const result = await collectLh();
    assert.equal(result.error?.code, 'NETWORK_ERROR');
    assert.equal(result.items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('collectAll: 기관별 부분 실패 메타데이터를 포함한다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes('i-sh.co.kr')) {
      return createFetchResponse(
        200,
        '<table><tr><td><a href="/notice/1">2026-001 1차 행복주택 입주자 모집</a></td><td>2026.03.01</td></tr></table>',
      );
    }

    throw new Error('lh endpoint timeout');
  };

  try {
    const result = await collectAll({ recentLimit: 1 });

    assert.equal(result.items.length, 1);
    assert.equal(result.by_org.SH.error, null);
    assert.equal(result.by_org.LH.error?.code, 'NETWORK_ERROR');
    assert.equal(result.has_partial_failure, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
