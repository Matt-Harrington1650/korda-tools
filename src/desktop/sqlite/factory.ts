import { isTauriRuntime } from '../../lib/runtime';
import type { SqliteClient } from './SqliteClient';
import { TauriSqliteClient } from './TauriSqliteClient';
import { WebSqliteClient } from './WebSqliteClient';

export const createSqliteClient = (): SqliteClient => {
  if (isTauriRuntime()) {
    return new TauriSqliteClient();
  }

  return new WebSqliteClient();
};
