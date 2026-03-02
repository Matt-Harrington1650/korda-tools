mod help;
mod object_store;
mod secrets;
mod tools;

const DB_URL: &str = "sqlite:korda_tools.db";

fn sql_migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "create_tools",
            sql: include_str!("../migrations/0001_create_tools.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "create_settings",
            sql: include_str!("../migrations/0002_create_settings.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "create_tool_run_logs",
            sql: include_str!("../migrations/0003_create_tool_run_logs.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "create_credentials",
            sql: include_str!("../migrations/0004_create_credentials.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 5,
            description: "create_migrations_table",
            sql: include_str!("../migrations/0005_create_migrations_table.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 6,
            description: "create_workflows",
            sql: include_str!("../migrations/0006_create_workflows.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 7,
            description: "create_workflow_runs",
            sql: include_str!("../migrations/0007_create_workflow_runs.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 8,
            description: "create_workflow_node_runs",
            sql: include_str!("../migrations/0008_create_workflow_node_runs.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 9,
            description: "create_schedules",
            sql: include_str!("../migrations/0009_create_schedules.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 10,
            description: "create_scheduled_run_logs",
            sql: include_str!("../migrations/0010_create_scheduled_run_logs.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 11,
            description: "create_chat_threads",
            sql: include_str!("../migrations/0011_create_chat_threads.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 12,
            description: "create_custom_tool_library",
            sql: include_str!("../migrations/0012_create_custom_tool_library.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 13,
            description: "harden_custom_tool_library",
            sql: include_str!("../migrations/0013_harden_custom_tool_library.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 14,
            description: "create_help_center",
            sql: include_str!("../migrations/0014_create_help_center.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 15,
            description: "create_governance_core",
            sql: include_str!("../migrations/0015_create_governance_core.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 16,
            description: "create_deliverables",
            sql: include_str!("../migrations/0016_create_deliverables.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 17,
            description: "harden_audit_chain",
            sql: include_str!("../migrations/0017_harden_audit_chain.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 18,
            description: "create_sheet_knowledge_tables",
            sql: include_str!("../migrations/0018_create_sheet_knowledge_tables.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            object_store::object_store_exists,
            object_store::object_store_mkdirp,
            object_store::object_store_write_file_atomic,
            object_store::object_store_read_file,
            tools::commands::tools_list,
            tools::commands::tool_get,
            tools::commands::tool_create,
            tools::commands::tool_add_version,
            tools::commands::tool_delete,
            tools::commands::tool_delete_version,
            tools::commands::tool_export_zip,
            tools::commands::tool_export_zip_payload,
            tools::commands::tool_preview_import_zip_payload,
            tools::commands::tool_import_zip,
            tools::commands::tool_import_zip_payload,
            help::commands::help_list_pages,
            help::commands::help_get_page,
            help::commands::help_create_page,
            help::commands::help_update_page,
            help::commands::help_delete_page,
            help::commands::app_state_get,
            help::commands::app_state_set
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, sql_migrations())
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::sql_migrations;
    use std::collections::HashSet;

    #[test]
    fn migrations_are_strictly_increasing() {
        let migrations = sql_migrations();
        assert!(!migrations.is_empty(), "migration list must not be empty");

        let mut previous = 0;
        for migration in migrations {
            assert!(
                migration.version > previous,
                "migration versions must be strictly increasing: {} <= {}",
                migration.version,
                previous
            );
            previous = migration.version;
        }
    }

    #[test]
    fn migration_descriptions_and_sql_are_valid() {
        let migrations = sql_migrations();
        let mut descriptions = HashSet::new();

        for migration in migrations {
            assert!(
                !migration.description.trim().is_empty(),
                "migration description must not be empty for version {}",
                migration.version
            );
            assert!(
                descriptions.insert(migration.description.to_string()),
                "duplicate migration description detected: {}",
                migration.description
            );
            assert!(
                !migration.sql.trim().is_empty(),
                "migration SQL must not be empty for version {}",
                migration.version
            );
        }
    }

    #[test]
    fn governance_migration_versions_present() {
        let versions: HashSet<i64> = sql_migrations()
            .into_iter()
            .map(|migration| migration.version)
            .collect();

        for expected in [15, 16, 17, 18] {
            assert!(
                versions.contains(&expected),
                "expected governance migration version {} to be present",
                expected
            );
        }
    }
}
