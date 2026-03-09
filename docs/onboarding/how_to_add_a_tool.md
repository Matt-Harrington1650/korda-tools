# How to Add a Tool

## Goal
Register a new internal tool type with typed config, adapter, and UI.

## Steps
1. Define tool behavior and config schema.
- Add schema in `src/plugins/schemas`.
- Ensure migration behavior is explicit for existing configs.

2. Add adapter implementation.
- Create adapter in `src/execution/adapters/` implementing `ToolAdapter`.
- Keep auth/secret resolution delegated to execution pipeline and secret vault.

3. Add plugin manifest.
- Update `src/plugins/builtinPlugins.ts` with:
  - `id`
  - `toolType`
  - `capabilities`
  - `configSchema`
  - `adapterFactory`
  - optional `ConfigPanel`

4. Register and validate.
- `src/plugins/registry.ts` auto-registers built-ins.
- Ensure no tool type collisions (`PluginRegistry` enforces uniqueness).

5. UI form integration.
- Add/extend config panel in `src/plugins/ui/BuiltinConfigPanels.tsx`.
- Validate through schema parse before save.

6. Test.
- Add or update tests for plugin registry and adapter behavior.
- Run `npm run test`.

## Guardrails
- Tool adapters should not import Tauri directly.
- Secrets must use credential references and secret vault.
- Keep execution-side policy checks in pipeline/service layer, not in UI.
