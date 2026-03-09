import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

const SNAPSHOT_NAME_PRESETS = [
  { value: 'daily', label: 'Daily Checkpoint' },
  { value: 'pre-release', label: 'Pre-Release Checkpoint' },
  { value: 'qa-smoke', label: 'QA Smoke Baseline' },
  { value: 'custom', label: 'Custom Name' },
] as const;

type SnapshotNamePreset = (typeof SNAPSHOT_NAME_PRESETS)[number]['value'];

export function SophonIndexPage() {
  const index = useSophonStore((store) => store.state.index);
  const rebuildIndex = useSophonStore((store) => store.rebuildIndex);
  const compactIndex = useSophonStore((store) => store.compactIndex);
  const validateIndex = useSophonStore((store) => store.validateIndex);
  const createSnapshot = useSophonStore((store) => store.createSnapshot);
  const restoreSnapshot = useSophonStore((store) => store.restoreSnapshot);
  const publishSnapshot = useSophonStore((store) => store.publishSnapshot);
  const [snapshotPreset, setSnapshotPreset] = useState<SnapshotNamePreset>('daily');
  const [customSnapshotName, setCustomSnapshotName] = useState('');

  const generateSnapshotName = (): string => {
    const dayStamp = new Date().toISOString().slice(0, 10);
    if (snapshotPreset === 'custom') {
      return customSnapshotName.trim();
    }
    if (snapshotPreset === 'daily') {
      return `snapshot-${dayStamp}`;
    }
    if (snapshotPreset === 'pre-release') {
      return `pre-release-${dayStamp}`;
    }
    return `qa-smoke-${dayStamp}`;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="kt-panel p-4 lg:col-span-1">
        <h3 className="kt-title-lg">Index Controls</h3>
        <div className="mt-3 space-y-2">
          <button
            className="kt-btn kt-btn-primary w-full"
            onClick={() => {
              rebuildIndex();
            }}
            type="button"
          >
            Rebuild Index
          </button>
          <button
            className="kt-btn kt-btn-secondary w-full"
            onClick={() => {
              compactIndex();
            }}
            type="button"
          >
            Compact Index
          </button>
          <button
            className="kt-btn kt-btn-secondary w-full"
            onClick={() => {
              validateIndex();
            }}
            type="button"
          >
            Validate Index
          </button>
          <div className="kt-panel-muted space-y-2 p-3">
            <label className="space-y-1">
              <span className="kt-title-sm">Snapshot Naming Mode</span>
              <select
                className="kt-select"
                onChange={(event) => {
                  setSnapshotPreset(event.target.value as SnapshotNamePreset);
                }}
                value={snapshotPreset}
              >
                {SNAPSHOT_NAME_PRESETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {snapshotPreset === 'custom' ? (
              <label className="space-y-1">
                <span className="kt-title-sm">Custom Snapshot Name</span>
                <input
                  className="kt-input"
                  onChange={(event) => {
                    setCustomSnapshotName(event.target.value);
                  }}
                  placeholder="project-gate-2026-03-07"
                  value={customSnapshotName}
                />
              </label>
            ) : (
              <p className="text-xs text-[color:var(--kt-text-muted)]">Generated name: {generateSnapshotName()}</p>
            )}
            <button
              className="kt-btn kt-btn-ghost w-full"
              onClick={() => {
                createSnapshot(generateSnapshotName());
                setCustomSnapshotName('');
              }}
              type="button"
            >
              Create Snapshot
            </button>
          </div>
        </div>
      </section>

      <section className="kt-panel p-4 lg:col-span-2">
        <h3 className="kt-title-lg">Index Stats</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="kt-kv">Documents: {index.docCount}</p>
          <p className="kt-kv">Chunks: {index.chunkCount}</p>
          <p className="kt-kv">Embedding: {index.embeddingModel}</p>
          <p className="kt-kv">Revision: {index.revision}</p>
          <p className="kt-kv">Integrity: {index.integrityStatus}</p>
          <p className="kt-kv">
            Active Snapshot: {index.activeSnapshotId ?? 'None'}
          </p>
          <p className="kt-kv sm:col-span-2">
            Last Updated: {index.lastUpdatedAt ? new Date(index.lastUpdatedAt).toLocaleString() : 'N/A'}
          </p>
          <p className="kt-kv sm:col-span-2">
            Last Validated: {index.lastValidatedAt ? new Date(index.lastValidatedAt).toLocaleString() : 'N/A'}
          </p>
        </div>

        <h4 className="mt-4 text-sm font-semibold text-[color:var(--kt-text-primary)]">Snapshots</h4>
        <div className="mt-2 space-y-2">
          {index.snapshots.length === 0 ? (
            <p className="kt-panel-muted border-dashed px-3 py-2 text-sm text-[color:var(--kt-text-muted)]">
              No snapshots yet.
            </p>
          ) : null}
          {index.snapshots.map((snapshot) => (
            <article key={snapshot.id} className="kt-panel-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{snapshot.name}</p>
                  <p className="text-xs text-[color:var(--kt-text-muted)]">{new Date(snapshot.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="kt-btn kt-btn-secondary"
                    onClick={() => {
                      restoreSnapshot(snapshot.id);
                    }}
                    type="button"
                  >
                    Restore
                  </button>
                  <button
                    className="kt-btn kt-btn-secondary"
                    onClick={() => {
                      publishSnapshot(snapshot.id);
                    }}
                    type="button"
                  >
                    Publish
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[color:var(--kt-text-secondary)]">
                {snapshot.docCount} docs / {snapshot.chunkCount} chunks / {snapshot.embeddingModel}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
