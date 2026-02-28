/** Storage 모듈. */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

import type { MatchedItem } from "../matcher/index.js";

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

export type AcceptanceRuntimeMetricRecord = {
  run_id: string;
  collected_success_count: number;
  required_fields_complete_count: number;
  review_needed_count: number;
};

export type NoticeSaveRecord = {
  announcement_id: string;
  source_org: string | null;
  application_type: string;
  application_type_raw: string | null;
  title: string;
  original_link: string | null;
  application_period: string | null;
  eligibility_rules_raw: string | null;
  region_requirement: string | null;
  household_requirement: string | null;
  income_requirement: string | null;
  asset_requirement: string | null;
  judgement_grade_cap: string;
  parse_status: string;
  source_snapshot_ref: string | null;
  content_hash: string;
};

export type EligibilityResultSaveRecord = {
  announcement_id: string;
  profile_id: string;
  grade: string;
  reasons_json: string;
  rule_version: string;
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
  saveAcceptanceRuntimeMetrics(record: AcceptanceRuntimeMetricRecord): void;
  getRecentAcceptanceRuntimeMetrics(
    limit: number,
  ): AcceptanceRuntimeMetricRecord[];
  saveNotices(records: NoticeSaveRecord[]): void;
  saveEligibilityResults(records: EligibilityResultSaveRecord[]): void;
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

  private readonly acceptanceMetrics: AcceptanceRuntimeMetricRecord[] = [];

  private readonly notices = new Map<string, NoticeSaveRecord>();

  private readonly eligibilityResults: EligibilityResultSaveRecord[] = [];

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

  saveAcceptanceRuntimeMetrics(record: AcceptanceRuntimeMetricRecord): void {
    this.acceptanceMetrics.push(record);
  }

  getRecentAcceptanceRuntimeMetrics(
    limit: number,
  ): AcceptanceRuntimeMetricRecord[] {
    if (limit <= 0) {
      return [];
    }

    return [...this.acceptanceMetrics].slice(-limit).reverse();
  }

  saveNotices(records: NoticeSaveRecord[]): void {
    for (const record of records) {
      this.notices.set(record.announcement_id, record);
    }
  }

  saveEligibilityResults(records: EligibilityResultSaveRecord[]): void {
    for (const record of records) {
      const existingIndex = this.eligibilityResults.findIndex(
        (r) =>
          r.announcement_id === record.announcement_id &&
          r.profile_id === record.profile_id &&
          r.rule_version === record.rule_version,
      );
      if (existingIndex >= 0) {
        this.eligibilityResults[existingIndex] = record;
      } else {
        this.eligibilityResults.push(record);
      }
    }
  }
}

let storageAdapter: StorageAdapter = new InMemoryStorageAdapter();
const require = createRequire(import.meta.url);

export const setStorageAdapter = (adapter: StorageAdapter): void => {
  storageAdapter = adapter;
};

export const resetStorageAdapter = (): void => {
  storageAdapter = new InMemoryStorageAdapter();
};

export const setSQLiteStorageAdapter = (dbPath: string): void => {
  const { SQLiteStorageAdapter } = require("./sqlite-adapter.js") as {
    SQLiteStorageAdapter: new (path: string) => StorageAdapter;
  };

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

export const saveAcceptanceRuntimeMetrics = (
  record: AcceptanceRuntimeMetricRecord,
): void => {
  storageAdapter.saveAcceptanceRuntimeMetrics(record);
};

export const getRecentAcceptanceRuntimeMetrics = (
  limit: number,
): AcceptanceRuntimeMetricRecord[] => {
  return storageAdapter.getRecentAcceptanceRuntimeMetrics(limit);
};

export const saveNotices = (items: MatchedItem[]): void => {
  const records: NoticeSaveRecord[] = items.map((item) => ({
    announcement_id: item.announcement_id,
    source_org: item.source_org,
    application_type: item.application_type,
    application_type_raw: item.application_type_raw ?? null,
    title: item.title,
    original_link: item.original_link ?? null,
    application_period: item.application_period ?? null,
    eligibility_rules_raw: item.eligibility_rules_raw ?? null,
    region_requirement: item.region_requirement ?? null,
    household_requirement: item.household_requirement ?? null,
    income_requirement: item.income_requirement ?? null,
    asset_requirement: item.asset_requirement ?? null,
    judgement_grade_cap: item.judgement_grade_cap,
    parse_status: item.judgement_grade_cap === "검토필요" ? "검토필요" : "PARSED",
    source_snapshot_ref: item.log.source_snapshot_ref ?? null,
    content_hash: buildContentHash(item),
  }));

  storageAdapter.saveNotices(records);
};

export const saveEligibilityResults = (
  items: MatchedItem[],
  profileId: string,
): void => {
  const records: EligibilityResultSaveRecord[] = items.map((item) => ({
    announcement_id: item.announcement_id,
    profile_id: profileId,
    grade: item.grade,
    reasons_json: JSON.stringify(item.reasons),
    rule_version: "v1",
  }));

  storageAdapter.saveEligibilityResults(records);
};
