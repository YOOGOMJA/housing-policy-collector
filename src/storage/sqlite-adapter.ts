import { DatabaseSync } from "node:sqlite";

import type {
  AcceptanceRuntimeMetricRecord,
  BatchRunHistoryRecord,
  EligibilityResultSaveRecord,
  NoticeSaveRecord,
  NotificationKeySaveResult,
  SaveResult,
  StorageAdapter,
} from "./index.js";

type AnnouncementRow = {
  announcement_id: string;
  source_snapshot_ref: string | null;
  content_hash: string;
};

type NotificationRow = {
  idempotency_key: string;
  announcement_id: string;
  profile_id: string;
};

export class SQLiteStorageAdapter implements StorageAdapter {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS announcements (
        announcement_id TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        source_snapshot_ref TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notification_deliveries (
        idempotency_key TEXT PRIMARY KEY,
        announcement_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        notified_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS batch_runs (
        run_id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        collected_count INTEGER NOT NULL,
        parsed_count INTEGER NOT NULL,
        matched_count INTEGER NOT NULL,
        notified_count INTEGER NOT NULL,
        saved_created_count INTEGER NOT NULL,
        saved_updated_count INTEGER NOT NULL,
        saved_skipped_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS acceptance_runtime_metrics (
        run_id TEXT PRIMARY KEY,
        collected_success_count INTEGER NOT NULL,
        required_fields_complete_count INTEGER NOT NULL,
        review_needed_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notices (
        announcement_id TEXT PRIMARY KEY,
        source_org TEXT,
        application_type TEXT NOT NULL DEFAULT 'UNKNOWN',
        application_type_raw TEXT,
        title TEXT NOT NULL,
        original_link TEXT,
        application_period TEXT,
        eligibility_rules_raw TEXT,
        region_requirement TEXT,
        household_requirement TEXT,
        income_requirement TEXT,
        asset_requirement TEXT,
        judgement_grade_cap TEXT NOT NULL,
        parse_status TEXT NOT NULL DEFAULT 'PARSED',
        source_snapshot_ref TEXT,
        content_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eligibility_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        announcement_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        grade TEXT NOT NULL,
        reasons_json TEXT NOT NULL DEFAULT '[]',
        rule_version TEXT NOT NULL DEFAULT 'v1',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(announcement_id, profile_id, rule_version)
      );
    `);
  }

  saveByAnnouncement(items: AnnouncementRow[]): SaveResult {
    const result: SaveResult = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    const selectExistingStmt = this.db.prepare(
      "SELECT content_hash FROM announcements WHERE announcement_id = ?",
    );
    const upsertStmt = this.db.prepare(`
      INSERT INTO announcements (announcement_id, content_hash, source_snapshot_ref, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id) DO UPDATE SET
        content_hash = excluded.content_hash,
        source_snapshot_ref = excluded.source_snapshot_ref,
        updated_at = datetime('now')
    `);

    this.db.exec("BEGIN");
    try {
      for (const item of items) {
        const existing = selectExistingStmt.get(item.announcement_id) as
          | { content_hash: string }
          | undefined;

        if (existing === undefined) {
          upsertStmt.run(
            item.announcement_id,
            item.content_hash,
            item.source_snapshot_ref,
          );
          result.created += 1;
          continue;
        }

        if (existing.content_hash === item.content_hash) {
          result.skipped += 1;
          continue;
        }

        upsertStmt.run(
          item.announcement_id,
          item.content_hash,
          item.source_snapshot_ref,
        );
        result.updated += 1;
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return result;
  }

  filterUnstoredNotificationKeys(keys: string[]): string[] {
    if (keys.length === 0) {
      return [];
    }

    const findStmt = this.db.prepare(
      "SELECT idempotency_key FROM notification_deliveries WHERE idempotency_key = ?",
    );

    return keys.filter((key) => findStmt.get(key) === undefined);
  }

  saveNotificationKeys(keys: NotificationRow[]): NotificationKeySaveResult {
    const result: NotificationKeySaveResult = {
      created: 0,
      skipped: 0,
      createdKeys: [],
    };

    const saveStmt = this.db.prepare(`
      INSERT INTO notification_deliveries (
        idempotency_key,
        announcement_id,
        profile_id,
        notified_at
      ) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(idempotency_key) DO NOTHING
    `);

    this.db.exec("BEGIN");
    try {
      for (const item of keys) {
        const runResult = saveStmt.run(
          item.idempotency_key,
          item.announcement_id,
          item.profile_id,
        );

        if (runResult.changes > 0) {
          result.created += 1;
          result.createdKeys.push(item.idempotency_key);
        } else {
          result.skipped += 1;
        }
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return result;
  }

  saveBatchRunHistory(record: BatchRunHistoryRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO batch_runs (
        run_id,
        profile_id,
        collected_count,
        parsed_count,
        matched_count,
        notified_count,
        saved_created_count,
        saved_updated_count,
        saved_skipped_count,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(run_id) DO UPDATE SET
        profile_id = excluded.profile_id,
        collected_count = excluded.collected_count,
        parsed_count = excluded.parsed_count,
        matched_count = excluded.matched_count,
        notified_count = excluded.notified_count,
        saved_created_count = excluded.saved_created_count,
        saved_updated_count = excluded.saved_updated_count,
        saved_skipped_count = excluded.saved_skipped_count,
        created_at = datetime('now')
    `);

    stmt.run(
      record.run_id,
      record.profile_id,
      record.collected_count,
      record.parsed_count,
      record.matched_count,
      record.notified_count,
      record.saved_created_count,
      record.saved_updated_count,
      record.saved_skipped_count,
    );
  }

  saveAcceptanceRuntimeMetrics(record: AcceptanceRuntimeMetricRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO acceptance_runtime_metrics (
        run_id,
        collected_success_count,
        required_fields_complete_count,
        review_needed_count,
        created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(run_id) DO UPDATE SET
        collected_success_count = excluded.collected_success_count,
        required_fields_complete_count = excluded.required_fields_complete_count,
        review_needed_count = excluded.review_needed_count,
        created_at = datetime('now')
    `);

    stmt.run(
      record.run_id,
      record.collected_success_count,
      record.required_fields_complete_count,
      record.review_needed_count,
    );
  }

  getRecentAcceptanceRuntimeMetrics(
    limit: number,
  ): AcceptanceRuntimeMetricRecord[] {
    if (limit <= 0) {
      return [];
    }

    const stmt = this.db.prepare(`
      SELECT
        run_id,
        collected_success_count,
        required_fields_complete_count,
        review_needed_count
      FROM acceptance_runtime_metrics
      ORDER BY datetime(created_at) DESC, rowid DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as AcceptanceRuntimeMetricRecord[];
    return rows;
  }

  saveNotices(records: NoticeSaveRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO notices (
        announcement_id,
        source_org,
        application_type,
        application_type_raw,
        title,
        original_link,
        application_period,
        eligibility_rules_raw,
        region_requirement,
        household_requirement,
        income_requirement,
        asset_requirement,
        judgement_grade_cap,
        parse_status,
        source_snapshot_ref,
        content_hash,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id) DO UPDATE SET
        source_org = excluded.source_org,
        application_type = excluded.application_type,
        application_type_raw = excluded.application_type_raw,
        title = excluded.title,
        original_link = excluded.original_link,
        application_period = excluded.application_period,
        eligibility_rules_raw = excluded.eligibility_rules_raw,
        region_requirement = excluded.region_requirement,
        household_requirement = excluded.household_requirement,
        income_requirement = excluded.income_requirement,
        asset_requirement = excluded.asset_requirement,
        judgement_grade_cap = excluded.judgement_grade_cap,
        parse_status = excluded.parse_status,
        source_snapshot_ref = excluded.source_snapshot_ref,
        content_hash = excluded.content_hash,
        updated_at = datetime('now')
    `);

    this.db.exec("BEGIN");
    try {
      for (const record of records) {
        stmt.run(
          record.announcement_id,
          record.source_org,
          record.application_type,
          record.application_type_raw,
          record.title,
          record.original_link,
          record.application_period,
          record.eligibility_rules_raw,
          record.region_requirement,
          record.household_requirement,
          record.income_requirement,
          record.asset_requirement,
          record.judgement_grade_cap,
          record.parse_status,
          record.source_snapshot_ref,
          record.content_hash,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  saveEligibilityResults(records: EligibilityResultSaveRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO eligibility_results (
        announcement_id,
        profile_id,
        grade,
        reasons_json,
        rule_version,
        created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id, profile_id, rule_version) DO UPDATE SET
        grade = excluded.grade,
        reasons_json = excluded.reasons_json,
        created_at = datetime('now')
    `);

    this.db.exec("BEGIN");
    try {
      for (const record of records) {
        stmt.run(
          record.announcement_id,
          record.profile_id,
          record.grade,
          record.reasons_json,
          record.rule_version,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
