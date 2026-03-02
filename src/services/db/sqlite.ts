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
    'openSqlite is an experimental integration hook and not part of authoritative runtime migrations.',
  );
}
