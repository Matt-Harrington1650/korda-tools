import { AppError } from '../../lib/errors';

export interface SqliteConnection {
  exec(sql: string): Promise<void>;
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  withTransaction<T>(action: (tx: SqliteConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface OpenSqliteOptions {
  dbPath: string;
  foreignKeys?: boolean;
  busyTimeoutMs?: number;
}

export async function openSqlite(options: OpenSqliteOptions): Promise<SqliteConnection> {
  void options;

  throw new AppError(
    'SQLITE_OPEN_NOT_IMPLEMENTED',
    'openSqlite is an integration hook. Wire this to Tauri backend commands or a SQLite bridge adapter.',
  );
}

// TODO: Implement Tauri-backed connection via invoke commands.
// TODO: Apply runtime connection pragmas: foreign_keys=ON, synchronous=NORMAL, wal_autocheckpoint=1000.