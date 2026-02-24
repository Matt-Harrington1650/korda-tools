import type { SqliteClient } from './SqliteClient';

export class WebSqliteClient implements SqliteClient {
  async execute(_sql: string, _params?: unknown[]): Promise<void> {
    throw new Error('not supported');
  }

  async select<T>(_sql: string, _params?: unknown[]): Promise<T[]> {
    throw new Error('not supported');
  }
}
