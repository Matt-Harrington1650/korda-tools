# How to Add a Tauri Command

## Principle
Commands are transport boundary only. Business logic belongs in Rust services/modules.

## Steps
1. Add command function in appropriate Rust module.
- Prefer existing category modules (`tools`, `help`, `secrets`, `object_store`, `sophon_runtime`, etc.).
- Validate inputs and return `Result<_, String>` with normalized messages.

2. Delegate to service/repository logic.
- Keep command body thin.
- Do not embed large business workflows directly in command function.

3. Register command in `src-tauri/src/lib.rs`.
- Add to `tauri::generate_handler![ ... ]` list.

4. Expose typed frontend call.
- Add/extend wrapper in `src/lib/tauri.ts` or a desktop adapter under `src/desktop/**`.
- Do not call `invoke` directly from feature/page modules.

5. Add tests.
- Rust unit/integration tests for service/DB behavior.
- TypeScript tests for adapter contract where applicable.

6. Validate.
- `cd src-tauri && cargo test`
- `npm run lint`
- `npm run typecheck`

## Security Checklist
- Validate path inputs against traversal where filesystem access is involved.
- Keep secrets in keyring layer only.
- Log useful context without leaking sensitive values.
