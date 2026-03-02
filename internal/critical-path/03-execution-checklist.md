# Critical Path Execution Checklist

## Execution Order (No Skipped Dependencies)
1. `Gate G0 - Boundary Lock`
- [ ] Confirm layer map: `ui -> domain -> adapters -> storage/execution`.
- [ ] Confirm runtime-gated Tauri imports only.
- [ ] Record approver in sign-off section.

2. `Gate G1 - Contract Lock`
- [ ] Finalize adapter interfaces for audit, storage, execution, and optional replication.
- [ ] Add TODO markers for cloud adapter implementations without enabling them by default.

3. `Gate G2 - Schema Lock`
- [ ] Create or verify forward-only SQLite migrations for audit/provenance/release evidence.
- [ ] Confirm schema version bump and migration id ordering.

4. `Gate G3 - Write-path Evidence`
- [ ] Ensure every create/update/delete command writes immutable audit event.
- [ ] Ensure `prev_hash` and `record_hash` are persisted atomically with the mutation.

5. `Gate G4 - Verification`
- [ ] Add hash-chain verification routine.
- [ ] Add replay routine that reconstructs entity state from events.

6. `Gate G5 - Automated Validation`
- [ ] Execute all required test and build commands.
- [ ] Archive command output in CI artifacts.

7. `Gate G6 - Immutable Release Record`
- [ ] Generate SHA-256 hashes for release artifacts.
- [ ] Store approval record and hashes as immutable evidence.

## Commands (Windows PowerShell)
```powershell
# 1) Policy and boundary checks
rg "^import .*@tauri-apps/" src | rg -v "src/lib/tauri.ts|src/desktop"

# 2) Frontend checks
npm run lint
npm run test
npm run build

# 3) Tauri checks
cargo test --manifest-path src-tauri/Cargo.toml

# 4) Release evidence hashes
Get-FileHash docs\critical-path\01-architecture-gates.md -Algorithm SHA256
Get-FileHash docs\critical-path\02-data-governance.md -Algorithm SHA256
Get-FileHash internal\critical-path\03-execution-checklist.md -Algorithm SHA256
```

## Sign-off Record (Immutable)
| Field | Value |
|---|---|
| Release Version | |
| Commit SHA | |
| Approver Name | |
| Approved At (UTC) | |
| Architecture Doc SHA-256 | |
| Governance Doc SHA-256 | |
| Checklist Doc SHA-256 | |
| Notes | |

## Binding Decision for Ambiguity
If a requirement can be interpreted in multiple ways, choose the stricter control that preserves immutability and audit evidence, and document it before implementation.

## Definition of Done
- All seven gates are marked complete with evidence.
- Command block executes successfully on Windows.
- Sign-off record is filled and persisted as immutable release evidence.

## Tests
```powershell
# Smoke test that required sections exist in every deliverable
rg -n "^## Definition of Done$|^## Tests$" docs/critical-path/*.md internal/critical-path/*.md

# Verify gate ordering exists
rg -n "Gate G0|Gate G1|Gate G2|Gate G3|Gate G4|Gate G5|Gate G6" internal/critical-path/03-execution-checklist.md
```