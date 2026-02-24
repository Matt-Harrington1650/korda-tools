export interface SqliteClient {
  execute: (sql: string, params?: unknown[]) => Promise<void>;
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
}
