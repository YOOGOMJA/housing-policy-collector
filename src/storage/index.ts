/** Storage 모듈. */

import { createHash } from 'node:crypto';

import type { MatchedItem } from '../matcher/index.js';

export type SaveResult = {
  created: number;
  updated: number;
  skipped: number;
};

export type NotificationKeySaveResult = {
  created: number;
  skipped: number;
  createdKeys: string[];
};

type AnnouncementRecord = {
  announcement_id: string;
  source_snapshot_ref: string | null;
  content_hash: string;
};

type StorageAdapter = {
  saveByAnnouncement(items: AnnouncementRecord[]): SaveResult;
  filterUnstoredNotificationKeys(keys: string[]): string[];
  saveNotificationKeys(keys: string[]): NotificationKeySaveResult;
};

const buildContentHash = (item: MatchedItem): string => {
  const normalizedPayload = {
    announcement_id: item.announcement_id,
    title: item.title,
    source_org: item.source_org,
    application_type_raw: item.application_type_raw,
    application_type: item.application_type,
    eligibility_rules_raw: item.eligibility_rules_raw,
    region_requirement: item.region_requirement,
    household_requirement: item.household_requirement,
    income_requirement: item.income_requirement,
    asset_requirement: item.asset_requirement,
    judgement_grade_cap: item.judgement_grade_cap,
    grade: item.grade,
    reasons: item.reasons,
  };

  return createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
};

class InMemoryStorageAdapter implements StorageAdapter {
  private readonly records = new Map<string, AnnouncementRecord>();

  private readonly notificationKeys = new Set<string>();

  saveByAnnouncement(items: AnnouncementRecord[]): SaveResult {
    const result: SaveResult = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const item of items) {
      const existing = this.records.get(item.announcement_id);

      if (existing === undefined) {
        this.records.set(item.announcement_id, item);
        result.created += 1;
        continue;
      }

      if (existing.content_hash === item.content_hash) {
        result.skipped += 1;
        continue;
      }

      this.records.set(item.announcement_id, item);
      result.updated += 1;
    }

    return result;
  }

  saveNotificationKeys(keys: string[]): NotificationKeySaveResult {
    const result: NotificationKeySaveResult = {
      created: 0,
      skipped: 0,
      createdKeys: [],
    };

    for (const key of keys) {
      if (this.notificationKeys.has(key)) {
        result.skipped += 1;
        continue;
      }

      this.notificationKeys.add(key);
      result.created += 1;
      result.createdKeys.push(key);
    }

    return result;
  }

  filterUnstoredNotificationKeys(keys: string[]): string[] {
    return keys.filter((key) => !this.notificationKeys.has(key));
  }
}

let storageAdapter: StorageAdapter = new InMemoryStorageAdapter();

export const setStorageAdapter = (adapter: StorageAdapter): void => {
  storageAdapter = adapter;
};

export const resetStorageAdapter = (): void => {
  storageAdapter = new InMemoryStorageAdapter();
};

export const save = (items: MatchedItem[]): SaveResult => {
  const records = items.map((item) => ({
    announcement_id: item.announcement_id,
    source_snapshot_ref: item.log.source_snapshot_ref,
    content_hash: buildContentHash(item),
  }));

  return storageAdapter.saveByAnnouncement(records);
};

export const saveNotificationIdempotencyKeys = (
  keys: string[],
): NotificationKeySaveResult => {
  return storageAdapter.saveNotificationKeys(keys);
};

export const filterUnstoredNotificationIdempotencyKeys = (
  keys: string[],
): string[] => {
  return storageAdapter.filterUnstoredNotificationKeys(keys);
};
