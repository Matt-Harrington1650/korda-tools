# How to Add a Feature

## Standard Feature Shape
Create under `src/features/<feature>/`:
- `components/`
- `screens/` (optional)
- `services/`
- `queries/` and/or `mutations/` (if async data)
- `schemas/`
- `store/` only if shared state is required
- `index.ts`

## Steps
1. Define domain and schema contracts.
- Add/extend types in `src/domain` and validation in `src/schemas` or feature schema module.

2. Add application/feature service.
- Place workflow logic in `services/`, not in page components.

3. Add UI components/screens.
- Keep components presentation-first.
- Use service hooks or query/mutation wrappers.

4. Wire route if needed.
- Update `src/app/router.tsx` only if feature is a top-level user job.

5. Add tests.
- Unit tests for service logic.
- Integration tests for adapter/persistence interaction where relevant.

6. Validate.
- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Rules
- No raw `@tauri-apps/*` import in feature modules.
- No direct secrets handling in UI.
- No SQL strings in page components.
