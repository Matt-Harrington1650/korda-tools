export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeMarker = (window as Window & { isTauri?: unknown }).isTauri;

  if (typeof runtimeMarker !== 'undefined') {
    if (typeof runtimeMarker === 'function') {
      try {
        return Boolean(runtimeMarker());
      } catch {
        return false;
      }
    }

    return Boolean(runtimeMarker);
  }

  return Boolean((window as Window & { __TAURI__?: unknown }).__TAURI__);
}
