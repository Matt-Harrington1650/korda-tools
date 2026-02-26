# Developer Notes

This page is intended for maintainers and advanced users.

## Local dev workflow (Windows + WSL optional)

| Area | Recommended approach |
|---|---|
| Frontend | Use `npm run dev` for React iteration. |
| Tauri desktop | Use `npm run tauri:dev` from Windows shell. |
| Rust backend checks | Run `cargo test` in `src-tauri`. |
| Node checks | Run `npm run lint` and `npm run test`. |

## WSL notes

- Keep desktop runtime tasks in Windows shell when using Tauri on Windows.
- WSL is useful for tooling parity and script automation, but GUI/runtime paths differ.
- Avoid mixing file paths (`/mnt/c/...` vs `C:\\...`) in build scripts.

## Safety and contribution rules

1. Treat imported/uploaded package files as inert assets.
2. Validate extension allowlist and size limits in both UI and backend.
3. Preserve migration order and backward compatibility.
4. Keep patches small and test before merge.

## Related pages

- [Introduction](help://introduction)
- [Troubleshooting](help://troubleshooting)
