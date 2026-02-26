# AI Tool Hub: Introduction

AI Tool Hub is a local desktop workspace for managing tool configurations, workflows, and versioned custom tool packages.

## What this app does

- Stores tool metadata and workflow definitions in local SQLite storage.
- Tracks versioned Custom Tools Library packages with files and install instructions.
- Supports import/export of shareable `.zip` packages for offline transfer.
- Helps teams standardize runbooks for tools (for example AutoCAD scripts and support docs).

## What this app does not do

| Item | Behavior |
|---|---|
| Cloud sync | No cloud dependency is required. |
| Automatic execution of uploaded files | Not supported. Uploaded files are stored as inert assets only. |
| Infrastructure orchestration | Out of scope. |

## Start here

- [Quick Start](help://quick-start)
- [Workflows Overview](help://workflows-overview)
- [Tools Library](help://tools-library)
- [Troubleshooting](help://troubleshooting)
- [Developer Notes](help://developer)

## Safety model

Custom package files (`.lsp`, `.scr`, `.cuix`, `.zip`, and docs) are persisted for reference, export, and import validation only.
Execution occurs in external tools under user control.
