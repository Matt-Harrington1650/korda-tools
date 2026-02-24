# Windows Release and Signing

This project is configured for Windows-first release automation with Tauri updater artifacts.

## Workflow

GitHub Actions workflow: `.github/workflows/release-windows.yml`

Triggers:
- `workflow_dispatch`
- git tags matching `v*`

The workflow:
1. Installs Node + Rust dependencies.
2. Validates updater signing secrets.
3. Optionally imports a Windows code-signing certificate.
4. Builds and uploads Tauri Windows bundles to a GitHub Release draft.

## Required secrets (updater signing)

Because `src-tauri/tauri.conf.json` enables `"bundle.createUpdaterArtifacts": true`, these secrets are required:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Generate updater signing keys with the Tauri signer CLI:

```bash
npx tauri signer generate -w ~/.tauri/ai-tool-hub.key
```

Set:
- private key file contents -> `TAURI_SIGNING_PRIVATE_KEY`
- password used at generation -> `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Optional secrets (Windows Authenticode)

If you want Authenticode signing in CI:

- `WINDOWS_CERTIFICATE_BASE64`: base64-encoded `.pfx`
- `WINDOWS_CERTIFICATE_PASSWORD`: certificate password

These are optional in the workflow. If not provided, bundles are still produced, but installer EXE/MSI Authenticode signing is skipped.

## Tauri updater plugin runtime config

Updater plugin is wired in Rust (`src-tauri/src/lib.rs`) and enabled in config (`src-tauri/tauri.conf.json`).

To make update checks succeed in production, add your updater endpoint(s) and public key under `plugins.updater` in `tauri.conf.json` (or inject via environment-specific config).

## Windows build artifacts

After `tauri build`, generated bundles are under:

- `src-tauri/target/release/bundle/`

Typical Windows artifacts include:

- `.msi` installer
- `.exe` installer (NSIS, if enabled)
- updater signature files (`.sig`)
- updater metadata JSON (for updater-enabled builds)

The GitHub release workflow uploads generated assets to the draft release.

