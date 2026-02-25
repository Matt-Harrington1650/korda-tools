import type { SqliteClient } from './SqliteClient';

const SQLITE_DB_URL = 'sqlite:korda_tools.db';

type DatabaseLike = {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
};

export class TauriSqliteClient implements SqliteClient {
  private dbPromise: Promise<DatabaseLike> | null = null;

  private async getDatabase(): Promise<DatabaseLike> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const plugin = await import('@tauri-apps/plugin-sql');
        return plugin.default.load(SQLITE_DB_URL) as Promise<DatabaseLike>;
      })();
    }

    return this.dbPromise;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await this.getDatabase();
    await db.execute(sql, params);
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDatabase();
    return db.select<T>(sql, params);
  }
}
