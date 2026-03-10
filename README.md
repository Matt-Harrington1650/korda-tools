# Korda Tools

Korda Tools is a Windows-first desktop application built with Tauri, React, and TypeScript.

It is the user-facing product for local engineering workflows, SOPHON ingestion, diagnostics, and governed tool execution. Internal runtime services are app-managed rather than user-managed.

## Primary goals

- one installable Windows desktop app
- formal GitHub-driven releases
- signed Tauri updater artifacts
- in-app update checks and installation
- app-managed startup, health, and diagnostics

## Local development

Requirements:
- Node.js 20+
- Rust stable
- Windows desktop environment for full Tauri execution

Common commands:

```powershell
npm ci
npm run typecheck
npm run test
npm run lint
npm run tauri:dev
```

`npm run version:sync` is run automatically by build and Tauri scripts so local versioned config stays aligned with `package.json`.

## Release system

The formal Windows release path is documented here:

- [docs/windows-release.md](docs/windows-release.md)

Summary:
- `main` and pull requests run CI only
- tags matching `vX.Y.Z` or `vX.Y.Z-rc.N` trigger the Windows release workflow
- GitHub Releases is the initial authoritative release channel
- Tauri updater artifacts are signed and published through GitHub Actions

## Runtime UX

Normal users should not need PowerShell for:
- install
- launch
- update
- startup diagnostics

Korda Tools exposes:
- `Settings -> App Updates`
- `Settings -> Startup and Runtime`

These surfaces report version, update state, startup orchestration state, health probes, retry actions, and diagnostics export.

