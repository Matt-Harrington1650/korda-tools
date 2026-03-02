import { AppError, isAppError } from '../../lib/errors';
import { openSqlite, type OpenSqliteOptions, type SqliteConnection } from './sqlite';

export interface MigrationFile {
  id: string;
  sql: string;
}

interface AppliedMigrationRow {
  applied_migrations: string;
}

export async function applyMigrations(
  connection: SqliteConnection,
  migrations: readonly MigrationFile[],
): Promise<void> {
  await ensureSchemaVersionTable(connection);
  const applied = await readAppliedMigrationSet(connection);

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    await connection.withTransaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.exec(
        `INSERT INTO schema_version (applied_migrations, applied_at_utc)
         VALUES ('${escapeSqlLiteral(migration.id)}', '${new Date().toISOString()}')`,
      );
    });
  }
}

export async function runMigrationsOnStartup(
  dbOptions: OpenSqliteOptions,
  migrations: readonly MigrationFile[],
): Promise<void> {
  const connection = await openSqlite(dbOptions);

  try {
    await applyMigrations(connection, migrations);
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw new AppError('MIGRATION_STARTUP_FAILED', 'Failed to apply startup migrations.', error);
  } finally {
    await connection.close();
  }
}

async function ensureSchemaVersionTable(connection: SqliteConnection): Promise<void> {
  await connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      applied_migrations TEXT PRIMARY KEY,
      applied_at_utc TEXT NOT NULL
    )
  `);
}

async function readAppliedMigrationSet(connection: SqliteConnection): Promise<Set<string>> {
  const rows = await connection.query<AppliedMigrationRow>(
    'SELECT applied_migrations FROM schema_version ORDER BY applied_migrations ASC',
  );

  const output = new Set<string>();
  for (const row of rows) {
    output.add(row.applied_migrations);
  }

  return output;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

// TODO: Load SQL from /migrations files via backend file service or generated manifest.
// TODO: Add checksum validation for migration tamper detection.
// TODO: Call runMigrationsOnStartup from the app bootstrap hook before service initialization.