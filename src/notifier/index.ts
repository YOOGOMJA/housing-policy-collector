/** Notifier 모듈. */

import type { MatchedItem } from '../matcher/index.js';
import { saveNotificationIdempotencyKeys } from '../storage/index.js';

export type NotificationMessage = {
  idempotencyKey: string;
  announcementId: string;
  profileId: string;
  grade: MatchedItem['grade'];
  text: string;
};

export type DeliveryResult = {
  channel: string;
  messageKey: string;
  success: boolean;
  attempts: number;
  error?: string;
};

export type NotificationChannelAdapter = {
  readonly channelName: string;
  send(messages: NotificationMessage[]): Promise<DeliveryResult[]>;
};

export type RetryPolicy = {
  maxAttempts: number;
  shouldRetry(result: DeliveryResult): boolean;
  getDelayMs(attempt: number): number;
};

export const buildNotificationIdempotencyKey = (
  announcementId: string,
  profileId: string,
  grade: MatchedItem['grade'],
): string => {
  return `${announcementId}:${profileId}:${grade}`;
};

const formatReason = (reasons: string[]): string => {
  if (reasons.length === 0) {
    return '판정 근거 없음';
  }

  return reasons.join(' | ');
};

export const formatMatchedItemsForUser = (
  matchedItems: MatchedItem[],
  profileId: string,
): NotificationMessage[] => {
  return matchedItems.map((item) => {
    const idempotencyKey = buildNotificationIdempotencyKey(
      item.announcement_id,
      profileId,
      item.grade,
    );
    const link = item.original_link ?? '링크 없음';

    return {
      idempotencyKey,
      announcementId: item.announcement_id,
      profileId,
      grade: item.grade,
      text: [
        `기관: ${item.source_org ?? '미상'}`,
        `공고명: ${item.title}`,
        `판정등급: ${item.grade}`,
        `판정근거: ${formatReason(item.reasons)}`,
        `링크: ${link}`,
      ].join('\n'),
    };
  });
};

const wait = async (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

export class FixedDelayRetryPolicy implements RetryPolicy {
  constructor(
    public readonly maxAttempts: number,
    private readonly delayMs: number,
  ) {}

  shouldRetry(result: DeliveryResult): boolean {
    return !result.success;
  }

  getDelayMs(): number {
    return this.delayMs;
  }
}

export class ConsoleSummaryChannel implements NotificationChannelAdapter {
  readonly channelName = 'console-summary';

  async send(messages: NotificationMessage[]): Promise<DeliveryResult[]> {
    if (messages.length > 0) {
      console.log(`notifier(${this.channelName}): ${messages.length}건 전송`);
    }

    return messages.map((message) => ({
      channel: this.channelName,
      messageKey: message.idempotencyKey,
      success: true,
      attempts: 1,
    }));
  }
}

export class SlackWebhookChannel implements NotificationChannelAdapter {
  readonly channelName = 'slack-webhook';

  constructor(
    private readonly webhookUrl: string,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {}

  async send(messages: NotificationMessage[]): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const message of messages) {
      try {
        const response = await this.fetchFn(this.webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            text: message.text,
          }),
        });

        results.push({
          channel: this.channelName,
          messageKey: message.idempotencyKey,
          success: response.ok,
          attempts: 1,
          error: response.ok ? undefined : `HTTP_${response.status}`,
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        results.push({
          channel: this.channelName,
          messageKey: message.idempotencyKey,
          success: false,
          attempts: 1,
          error: `NETWORK_ERROR: ${messageText}`,
        });
      }
    }

    return results;
  }
}

const sendWithRetry = async (
  channel: NotificationChannelAdapter,
  messages: NotificationMessage[],
  retryPolicy: RetryPolicy,
): Promise<DeliveryResult[]> => {
  const finalResults: DeliveryResult[] = [];

  for (const message of messages) {
    let attempt = 0;
    let currentResult: DeliveryResult | undefined;

    while (attempt < retryPolicy.maxAttempts) {
      attempt += 1;
      const [result] = await channel.send([message]);
      currentResult = {
        ...result,
        attempts: attempt,
      };

      if (!retryPolicy.shouldRetry(currentResult)) {
        break;
      }

      if (attempt < retryPolicy.maxAttempts) {
        await wait(retryPolicy.getDelayMs(attempt));
      }
    }

    if (currentResult !== undefined) {
      finalResults.push(currentResult);
    }
  }

  return finalResults;
};

export type NotifyOptions = {
  profileId?: string;
  channels?: NotificationChannelAdapter[];
  retryPolicy?: RetryPolicy;
};

export const notify = async (
  matchedItems: MatchedItem[],
  options: NotifyOptions = {},
): Promise<number> => {
  const profileId = options.profileId ?? 'default-profile';
  const formatted = formatMatchedItemsForUser(matchedItems, profileId);
  const keySaveResult = saveNotificationIdempotencyKeys(
    formatted.map((message) => message.idempotencyKey),
  );

  const createdKeySet = new Set(keySaveResult.createdKeys);
  const deduplicatedMessages = formatted.filter((message) => createdKeySet.has(message.idempotencyKey));
  if (deduplicatedMessages.length === 0) {
    return 0;
  }

  const retryPolicy = options.retryPolicy ?? new FixedDelayRetryPolicy(1, 0);
  const channels = options.channels ?? [new ConsoleSummaryChannel()];

  if (process.env.SLACK_WEBHOOK_URL !== undefined && options.channels === undefined) {
    channels.push(new SlackWebhookChannel(process.env.SLACK_WEBHOOK_URL));
  }

  const channelResults = await Promise.all(
    channels.map((channel) => sendWithRetry(channel, deduplicatedMessages, retryPolicy)),
  );

  const successfulMessageKeys = new Set(
    channelResults.flat().filter((result) => result.success).map((result) => result.messageKey),
  );

  return successfulMessageKeys.size;
};
