import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonIndexPage() {
  const index = useSophonStore((store) => store.state.index);
  const rebuildIndex = useSophonStore((store) => store.rebuildIndex);
  const compactIndex = useSophonStore((store) => store.compactIndex);
  const validateIndex = useSophonStore((store) => store.validateIndex);
  const createSnapshot = useSophonStore((store) => store.createSnapshot);
  const restoreSnapshot = useSophonStore((store) => store.restoreSnapshot);
  const publishSnapshot = useSophonStore((store) => store.publishSnapshot);
  const [snapshotName, setSnapshotName] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
        <h3 className="text-base font-semibold text-slate-900">Index Controls</h3>
        <div className="mt-3 space-y-2">
          <button
            className="w-full rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
            onClick={() => {
              rebuildIndex();
            }}
            type="button"
          >
            Rebuild Index
          </button>
          <button
            className="w-full rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            onClick={() => {
              compactIndex();
            }}
            type="button"
          >
            Compact Index
          </button>
          <button
            className="w-full rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            onClick={() => {
              validateIndex();
            }}
            type="button"
          >
            Validate Index
          </button>
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase text-slate-600">Snapshot Name</span>
              <input
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                onChange={(event) => {
                  setSnapshotName(event.target.value);
                }}
                placeholder="pre-release-checkpoint"
                value={snapshotName}
              />
            </label>
            <button
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
              onClick={() => {
                createSnapshot(snapshotName);
                setSnapshotName('');
              }}
              type="button"
            >
              Create Snapshot
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
        <h3 className="text-base font-semibold text-slate-900">Index Stats</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Documents: {index.docCount}</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Chunks: {index.chunkCount}</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Embedding: {index.embeddingModel}</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Revision: {index.revision}</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Integrity: {index.integrityStatus}</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            Active Snapshot: {index.activeSnapshotId ?? 'None'}
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
            Last Updated: {index.lastUpdatedAt ? new Date(index.lastUpdatedAt).toLocaleString() : 'N/A'}
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2">
            Last Validated: {index.lastValidatedAt ? new Date(index.lastValidatedAt).toLocaleString() : 'N/A'}
          </p>
        </div>

        <h4 className="mt-4 text-sm font-semibold text-slate-900">Snapshots</h4>
        <div className="mt-2 space-y-2">
          {index.snapshots.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No snapshots yet.
            </p>
          ) : null}
          {index.snapshots.map((snapshot) => (
            <article key={snapshot.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{snapshot.name}</p>
                  <p className="text-xs text-slate-600">{new Date(snapshot.createdAt).toLocaleString()}</p>
                </div>
                <button
                  className="rounded border border-blue-300 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    restoreSnapshot(snapshot.id);
                  }}
                  type="button"
                >
                  Restore
                </button>
                <button
                  className="rounded border border-blue-300 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    publishSnapshot(snapshot.id);
                  }}
                  type="button"
                >
                  Publish
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-700">
                {snapshot.docCount} docs / {snapshot.chunkCount} chunks / {snapshot.embeddingModel}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
