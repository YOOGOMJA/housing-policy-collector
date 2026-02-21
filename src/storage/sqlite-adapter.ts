import { DatabaseSync } from 'node:sqlite';

import type {
  BatchRunHistoryRecord,
  NotificationKeySaveResult,
  SaveResult,
  StorageAdapter,
} from './index.js';

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
    `);
  }

  saveByAnnouncement(items: AnnouncementRow[]): SaveResult {
    const result: SaveResult = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    const selectExistingStmt = this.db.prepare(
      'SELECT content_hash FROM announcements WHERE announcement_id = ?',
    );
    const upsertStmt = this.db.prepare(`
      INSERT INTO announcements (announcement_id, content_hash, source_snapshot_ref, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id) DO UPDATE SET
        content_hash = excluded.content_hash,
        source_snapshot_ref = excluded.source_snapshot_ref,
        updated_at = datetime('now')
    `);

    this.db.exec('BEGIN');
    try {
      for (const item of items) {
        const existing = selectExistingStmt.get(item.announcement_id) as
          | { content_hash: string }
          | undefined;

        if (existing === undefined) {
          upsertStmt.run(item.announcement_id, item.content_hash, item.source_snapshot_ref);
          result.created += 1;
          continue;
        }

        if (existing.content_hash === item.content_hash) {
          result.skipped += 1;
          continue;
        }

        upsertStmt.run(item.announcement_id, item.content_hash, item.source_snapshot_ref);
        result.updated += 1;
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return result;
  }

  filterUnstoredNotificationKeys(keys: string[]): string[] {
    if (keys.length === 0) {
      return [];
    }

    const findStmt = this.db.prepare(
      'SELECT idempotency_key FROM notification_deliveries WHERE idempotency_key = ?',
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

    this.db.exec('BEGIN');
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
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
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
}
