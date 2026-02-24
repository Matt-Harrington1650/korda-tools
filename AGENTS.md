# AGENTS.md — AI Tool Hub project rules

## Goal
Build a desktop-first AI Tool Hub MVP with:
- Dashboard (tool cards/grid/list toggle)
- Add Tool flow
- Tool detail page
- Settings page
- Extensible architecture for future tool/provider plugins

## Tech stack
- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- TanStack Query
- React Hook Form + Zod
- Strict typing

## Architectural rules
- Separate UI / domain / storage / execution layers
- All tool types use typed adapters
- All persisted entities use versioned schemas
- No secrets hardcoded
- Never import @tauri-apps/* at module top-level in code paths used by web dev; use runtime-gated dynamic imports
- Add TODO markers for extension points
- Prefer small composable modules over large files

## MVP scope now
- Local-only tool registry CRUD
- Basic test/run execution for REST-like tools
- Minimal local request/response history
- Mock provider status okay initially

## Code quality
- Keep code buildable at each step
- Use clear naming
- Lightweight comments only at extension points
- Do not overengineer
