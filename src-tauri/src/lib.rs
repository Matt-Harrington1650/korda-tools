mod secrets;

const DB_URL: &str = "sqlite:ai_tool_hub.db";

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
  ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      secrets::secret_set,
      secrets::secret_get,
      secrets::secret_delete
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
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
