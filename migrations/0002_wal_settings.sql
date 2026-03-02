-- WAL settings migration.
-- journal_mode is persisted at DB file level once accepted by SQLite.
PRAGMA journal_mode = WAL;

-- synchronous and wal_autocheckpoint should also be set during runtime open hook
-- because these are connection-level settings.
PRAGMA synchronous = NORMAL;
PRAGMA wal_autocheckpoint = 1000;