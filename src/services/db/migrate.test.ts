import { describe, expect, it } from 'vitest';

import { applyMigrations, type MigrationFile } from './migrate';
import type { SqliteConnection } from './sqlite';

interface Row {
  applied_migrations: string;
}

class FakeConnection implements SqliteConnection {
  readonly executed: string[] = [];
  readonly applied: string[];
  failOnSql: string | null = null;

  constructor(applied: string[] = []) {
    this.applied = [...applied];
  }

  async exec(sql: string): Promise<void> {
    if (this.failOnSql && sql.includes(this.failOnSql)) {
      throw new Error('forced migration failure');
    }

    this.executed.push(sql);

    const match = sql.match(/INSERT INTO schema_version[\s\S]*VALUES \('([^']+)'/);
    if (match) {
      this.applied.push(match[1]);
    }
  }

  async query<T>(sql: string): Promise<readonly T[]> {
    this.executed.push(sql);
    if (sql.includes('SELECT applied_migrations FROM schema_version')) {
      return this.applied.map((id) => ({ applied_migrations: id } as Row as T));
    }

    return [];
  }

  async withTransaction<T>(action: (tx: SqliteConnection) => Promise<T>): Promise<T> {
    return action(this);
  }

  async close(): Promise<void> {
    return;
  }
}

describe('applyMigrations', () => {
  it('applies pending migrations in order and records them', async () => {
    const connection = new FakeConnection();
    const migrations: readonly MigrationFile[] = [
      { id: '0001_init.sql', sql: 'CREATE TABLE a(id INTEGER);' },
      { id: '0002_more.sql', sql: 'CREATE TABLE b(id INTEGER);' },
    ];

    await applyMigrations(connection, migrations);

    const createAIndex = connection.executed.findIndex((entry) => entry.includes('CREATE TABLE a'));
    const createBIndex = connection.executed.findIndex((entry) => entry.includes('CREATE TABLE b'));
    expect(createAIndex).toBeGreaterThan(-1);
    expect(createBIndex).toBeGreaterThan(createAIndex);

    expect(connection.applied).toEqual(['0001_init.sql', '0002_more.sql']);
  });

  it('skips migrations that are already recorded', async () => {
    const connection = new FakeConnection(['0001_init.sql']);
    const migrations: readonly MigrationFile[] = [
      { id: '0001_init.sql', sql: 'CREATE TABLE a(id INTEGER);' },
      { id: '0002_more.sql', sql: 'CREATE TABLE b(id INTEGER);' },
    ];

    await applyMigrations(connection, migrations);

    const executedSql = connection.executed.join('\n');
    expect(executedSql.includes('CREATE TABLE a(id INTEGER);')).toBe(false);
    expect(executedSql.includes('CREATE TABLE b(id INTEGER);')).toBe(true);
    expect(connection.applied).toEqual(['0001_init.sql', '0002_more.sql']);
  });

  it('does not record migration when migration SQL fails', async () => {
    const connection = new FakeConnection();
    connection.failOnSql = 'CREATE TABLE broken';
    const migrations: readonly MigrationFile[] = [
      { id: '0003_broken.sql', sql: 'CREATE TABLE broken(id INTEGER);' },
    ];

    await expect(applyMigrations(connection, migrations)).rejects.toThrow('forced migration failure');
    expect(connection.applied).toEqual([]);
  });
});