import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { resolveUserProfileFromArgs } from '../src/main.js';

test('resolveUserProfileFromArgs: profile-json에 공백 값이 있으면 에러를 던진다', async () => {
  await assert.rejects(
    resolveUserProfileFromArgs([
      'node',
      'main.ts',
      '--profile-json',
      '{"region":"","incomeBand":"","assetBand":"","householdType":""}',
    ]),
    /invalid UserProfile: region must be non-empty string/,
  );
});

test('resolveUserProfileFromArgs: profile-file 입력을 trim 후 정상 파싱한다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-test-'));
  const profilePath = join(dir, 'profile.json');
  await writeFile(
    profilePath,
    '{"region":" 서울 ","incomeBand":" 100% 이하 ","assetBand":" 3억 이하 ","householdType":" 무주택세대구성원 "}',
    'utf8',
  );

  const profile = await resolveUserProfileFromArgs(['node', 'main.ts', '--profile-file', profilePath]);

  assert.deepEqual(profile, {
    region: '서울',
    incomeBand: '100% 이하',
    assetBand: '3억 이하',
    householdType: '무주택세대구성원',
  });
});
