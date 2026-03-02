# Open Gaps Register (v1)

## Gaps
| Gap | Severity | Owner | Target Wave | Current Status | Next Action |
|---|---|---|---|---|---|
| Runtime migration authority split between `src-tauri/migrations` and root `/migrations` | H | Platform Engineering | Wave 1 | Resolved | Ported governance/storage migrations into `src-tauri/migrations` and wired versions `0015-0018` in `src-tauri/src/lib.rs` |
| New storage/deliverable/audit service skeletons not fully wired into active app flows | H | Application Engineering | Waves 2-4 | Open | Integrate service entry points in ingest/finalize/query/export paths |
| Classification policy defined but not enforced end-to-end in runtime | H | Security + App Engineering | Wave 5 | Open | Add policy checks at ingest/read/export/external-AI boundaries |
| AI confidence labeling policy not enforced in response contract | H | AI Platform | Wave 5 | Open | Add response schema validation and review triggers |
| Drawing-centric schema not present in active runtime DB migration chain | H | Data Platform | Wave 6 | Open | Add and test `sheets` and linking tables in Tauri migrations |
| Audit chain service exists but append/verify not integrated across all state changes | H | Platform Engineering | Wave 4 | Open | Wire append events and periodic verify job |
| Migration integrity tests for runtime chain are missing | M | Platform Engineering | Wave 1 | Resolved | Added migration ordering/uniqueness/presence tests in `src-tauri/src/lib.rs` |
| Operational runbooks for incident/restore/re-index/retention not yet codified | M | Operations + Security | Wave 7 | Resolved | Added runbooks under `docs/operations/*` |
| CI pipeline lacks governance and migration-specific gates beyond build/test | M | DevEx | Wave 7 | Resolved | Added policy scans + migration-chain sanity + governance doc checks in `.github/workflows/ci.yml` |
| Chunk size warning indicates potential frontend bundle bloat | L | Frontend | Wave 7 | Open | Add chunking strategy and monitor bundle budget |

## Build Verification Record
- Command: `npm run build`
- Result: PASS
- Date: 2026-03-02
- Notes: Build succeeds; bundle-size warning remains and is tracked as low severity.

## Runtime Migration Verification Record
- Command: `$env:CARGO_INCREMENTAL='0'; $env:CARGO_TARGET_DIR='C:\\code\\target-codex-wave6'; cargo test --manifest-path src-tauri/Cargo.toml --lib`
- Result: PASS
- Notes: Includes migration integrity tests plus existing Rust test suite.

## Gate Check Snippet
- `rg -n "Gap|Severity|Owner|Target Wave" docs/open_gaps_register_v1.md`
