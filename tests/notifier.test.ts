import assert from 'node:assert/strict';
import test from 'node:test';

import type { MatchedItem } from '../src/matcher/index.js';
import {
  type DeliveryResult,
  FixedDelayRetryPolicy,
  formatMatchedItemsForUser,
  type NotificationChannelAdapter,
  type NotificationMessage,
  notify,
} from '../src/notifier/index.js';
import { resetStorageAdapter } from '../src/storage/index.js';

const createMatchedItem = (
  overrides: Partial<MatchedItem> = {},
): MatchedItem => {
  return {
    sourceId: 'source-1',
    title: '2026-001 1차 행복주택 모집',
    original_link: 'https://example.com/notice/1',
    application_period: '2026-04-01~2026-04-10',
    source_org: 'SH',
    announcement_id: 'SH-2026-001-1',
    application_type_raw: '행복주택',
    application_type: 'PUBLIC_RENTAL',
    eligibility_rules_raw:
      '서울시 거주, 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 이하',
    region_requirement: '서울시 거주',
    household_requirement: '무주택세대구성원',
    income_requirement: '도시근로자 월평균소득 100% 이하',
    asset_requirement: '총자산 3억 이하',
    judgement_grade_cap: '확정 가능',
    log: {
      trace_id: 'trace-1',
      failure_reason: null,
      source_snapshot_ref: 'snapshot://sh/2026-001-v1',
      metadata: {
        failure_reasons: [],
        ambiguous_fragments: [],
      },
    },
    grade: '유력',
    reasons: ['INITIAL_RULE_MATCH: conservative-pass'],
    ...overrides,
  };
};

class RecordingChannel implements NotificationChannelAdapter {
  readonly channelName = 'recording';

  public readonly sentMessages: NotificationMessage[] = [];

  constructor(private readonly succeedAtAttempt: number = 1) {}

  private attemptCountByKey = new Map<string, number>();

  async send(messages: NotificationMessage[]): Promise<DeliveryResult[]> {
    this.sentMessages.push(...messages);

    return messages.map((message) => {
      const nextAttempt = (this.attemptCountByKey.get(message.idempotencyKey) ?? 0) + 1;
      this.attemptCountByKey.set(message.idempotencyKey, nextAttempt);
      const success = nextAttempt >= this.succeedAtAttempt;

      return {
        channel: this.channelName,
        messageKey: message.idempotencyKey,
        success,
        attempts: 1,
        error: success ? undefined : 'temporary_failure',
      };
    });
  }
}

test('formatMatchedItemsForUser: 사용자 관점 메시지 포맷을 생성한다', () => {
  const messages = formatMatchedItemsForUser([createMatchedItem()], 'profile-1');

  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /기관: SH/);
  assert.match(messages[0].text, /공고명: 2026-001 1차 행복주택 모집/);
  assert.match(messages[0].text, /판정등급: 유력/);
  assert.match(messages[0].text, /판정근거: INITIAL_RULE_MATCH: conservative-pass/);
  assert.match(messages[0].text, /링크: https:\/\/example.com\/notice\/1/);
});

test('notify: 실패 후 retry policy에 따라 재시도한다', async () => {
  resetStorageAdapter();
  const channel = new RecordingChannel(2);

  const notified = await notify([createMatchedItem()], {
    profileId: 'profile-2',
    channels: [channel],
    retryPolicy: new FixedDelayRetryPolicy(2, 0),
  });

  assert.equal(notified, 1);
  assert.equal(channel.sentMessages.length, 2);
});

test('notify: announcement_id + profile_id + grade 중복 키는 재전송하지 않는다', async () => {
  resetStorageAdapter();
  const channel = new RecordingChannel(1);

  const first = await notify([createMatchedItem()], {
    profileId: 'profile-3',
    channels: [channel],
    retryPolicy: new FixedDelayRetryPolicy(1, 0),
  });

  const second = await notify([createMatchedItem()], {
    profileId: 'profile-3',
    channels: [channel],
    retryPolicy: new FixedDelayRetryPolicy(1, 0),
  });

  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(channel.sentMessages.length, 1);
});
