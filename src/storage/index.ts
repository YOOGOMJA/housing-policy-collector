/** Storage 모듈. */

import { createHash } from "node:crypto";

import type { MatchedItem } from "../matcher/index.js";
import { SQLiteStorageAdapter } from "./sqlite-adapter.js";

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

export type BatchRunHistoryRecord = {
  run_id: string;
  profile_id: string;
  collected_count: number;
  parsed_count: number;
  matched_count: number;
  notified_count: number;
  saved_created_count: number;
  saved_updated_count: number;
  saved_skipped_count: number;
};

type AnnouncementRecord = {
  announcement_id: string;
  source_snapshot_ref: string | null;
  content_hash: string;
};

type NotificationKeyRecord = {
  idempotency_key: string;
  announcement_id: string;
  profile_id: string;
};

export type StorageAdapter = {
  saveByAnnouncement(items: AnnouncementRecord[]): SaveResult;
  filterUnstoredNotificationKeys(keys: string[]): string[];
  saveNotificationKeys(
    keys: NotificationKeyRecord[],
  ): NotificationKeySaveResult;
  saveBatchRunHistory(record: BatchRunHistoryRecord): void;
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

  return createHash("sha256")
    .update(JSON.stringify(normalizedPayload))
    .digest("hex");
};

const parseNotificationKey = (key: string): NotificationKeyRecord => {
  const [
    announcementId = "unknown-announcement",
    profileId = "unknown-profile",
  ] = key.split(":");
  return {
    idempotency_key: key,
    announcement_id: announcementId,
    profile_id: profileId,
  };
};

class InMemoryStorageAdapter implements StorageAdapter {
  private readonly records = new Map<string, AnnouncementRecord>();

  private readonly notificationKeys = new Set<string>();

  private readonly batchRuns = new Map<string, BatchRunHistoryRecord>();

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

  saveNotificationKeys(
    keys: NotificationKeyRecord[],
  ): NotificationKeySaveResult {
    const result: NotificationKeySaveResult = {
      created: 0,
      skipped: 0,
      createdKeys: [],
    };

    for (const key of keys) {
      if (this.notificationKeys.has(key.idempotency_key)) {
        result.skipped += 1;
        continue;
      }

      this.notificationKeys.add(key.idempotency_key);
      result.created += 1;
      result.createdKeys.push(key.idempotency_key);
    }

    return result;
  }

  filterUnstoredNotificationKeys(keys: string[]): string[] {
    return keys.filter((key) => !this.notificationKeys.has(key));
  }

  saveBatchRunHistory(record: BatchRunHistoryRecord): void {
    this.batchRuns.set(record.run_id, record);
  }
}

let storageAdapter: StorageAdapter = new InMemoryStorageAdapter();

export const setStorageAdapter = (adapter: StorageAdapter): void => {
  storageAdapter = adapter;
};

export const resetStorageAdapter = (): void => {
  storageAdapter = new InMemoryStorageAdapter();
};

export const setSQLiteStorageAdapter = (dbPath: string): void => {
  storageAdapter = new SQLiteStorageAdapter(dbPath);
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
  const records = keys.map(parseNotificationKey);
  return storageAdapter.saveNotificationKeys(records);
};

export const filterUnstoredNotificationIdempotencyKeys = (
  keys: string[],
): string[] => {
  return storageAdapter.filterUnstoredNotificationKeys(keys);
};

export const saveBatchRunHistory = (record: BatchRunHistoryRecord): void => {
  storageAdapter.saveBatchRunHistory(record);
};
