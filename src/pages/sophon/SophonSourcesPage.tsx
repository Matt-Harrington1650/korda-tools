import { useMemo, useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';
import type { SophonSourceType } from '../../features/sophon/types';

export function SophonSourcesPage() {
  const sources = useSophonStore((store) => store.state.sources);
  const addSource = useSophonStore((store) => store.addSource);
  const removeSource = useSophonStore((store) => store.removeSource);
  const queueIngestion = useSophonStore((store) => store.queueIngestion);

  const [sourceType, setSourceType] = useState<SophonSourceType>('folder');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [includePatterns, setIncludePatterns] = useState('**/*.pdf,**/*.docx');
  const [excludePatterns, setExcludePatterns] = useState('**/tmp/**,**/~$*');
  const [extensions, setExtensions] = useState('.pdf,.docx,.dwg,.dxf,.ifc,.xlsx,.csv,.txt,.jpg,.png');
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [safeMode, setSafeMode] = useState(false);

  const sourceCount = sources.length;
  const watchCount = useMemo(() => sources.filter((item) => item.settings.watchEnabled).length, [sources]);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
        <h3 className="text-base font-semibold text-slate-900">Add Source</h3>
        <p className="mt-1 text-xs text-slate-500">
          Configure source rules for enumerate, extract, chunk, embed, index, validate, publish.
        </p>
        <div className="mt-3 space-y-3">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Source Type</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setSourceType(event.target.value as SophonSourceType);
              }}
              value={sourceType}
            >
              <option value="folder">Folder (Recursive)</option>
              <option value="file">Single File</option>
              <option value="project_vault">Project Vault</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Name</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setName(event.target.value);
              }}
              value={name}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Path</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setPath(event.target.value);
              }}
              placeholder="D:\\KORDA\\Projects\\EPC-A"
              value={path}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Include Patterns</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setIncludePatterns(event.target.value);
              }}
              value={includePatterns}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Exclude Patterns</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setExcludePatterns(event.target.value);
              }}
              value={excludePatterns}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase text-slate-600">Allowed Extensions</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setExtensions(event.target.value);
              }}
              value={extensions}
            />
          </label>
          <label className="flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <input
              checked={watchEnabled}
              onChange={(event) => {
                setWatchEnabled(event.target.checked);
              }}
              type="checkbox"
            />
            Enable watch mode (periodic scan + debounce)
          </label>
          <button
            className="w-full rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
            onClick={() => {
              if (!name.trim() || !path.trim()) {
                return;
              }
              addSource({
                sourceType,
                name,
                path,
                includePatterns: splitList(includePatterns),
                excludePatterns: splitList(excludePatterns),
                allowedExtensions: splitList(extensions),
                watchEnabled,
                chunkSize: 1024,
                chunkOverlap: 150,
                ocrEnabled: true,
                extractionEnabled: true,
                pageAwareChunking: true,
                maxFileSizeMb: 1024,
                maxPages: 5000,
                tags: ['sophon', 'ingestion'],
                sensitivity: 'Internal',
              });
              setName('');
              setPath('');
            }}
            type="button"
          >
            Save Source
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Configured Sources</h3>
          <div className="flex gap-2 text-xs">
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">Total: {sourceCount}</span>
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1">Watch: {watchCount}</span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <label className="flex items-center gap-2">
            <input
              checked={dryRun}
              onChange={(event) => {
                setDryRun(event.target.checked);
              }}
              type="checkbox"
            />
            Dry-run
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={safeMode}
              onChange={(event) => {
                setSafeMode(event.target.checked);
              }}
              type="checkbox"
            />
            Safe mode (single-thread style)
          </label>
        </div>

        <div className="space-y-3">
          {sources.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No sources yet. Add one source and queue ingestion.
            </p>
          ) : null}

          {sources.map((source) => (
            <article key={source.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium text-slate-900">{source.name}</h4>
                  <p className="text-xs text-slate-600">
                    {source.sourceType} - {source.path}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                    onClick={() => {
                      queueIngestion({
                        sourceId: source.id,
                        dryRun,
                        safeMode,
                      });
                    }}
                    type="button"
                  >
                    Queue Ingestion
                  </button>
                  <button
                    className="rounded border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      removeSource(source.id);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                <p className="rounded bg-slate-50 px-2 py-1">Include: {source.settings.includePatterns.join(', ')}</p>
                <p className="rounded bg-slate-50 px-2 py-1">Exclude: {source.settings.excludePatterns.join(', ')}</p>
                <p className="rounded bg-slate-50 px-2 py-1">
                  Chunk: {source.settings.chunkSize} / overlap {source.settings.chunkOverlap}
                </p>
                <p className="rounded bg-slate-50 px-2 py-1">
                  Watch: {source.settings.watchEnabled ? `On (${source.settings.watchIntervalSec}s)` : 'Off'}
                </p>
                <p className="rounded bg-slate-50 px-2 py-1">
                  Max: {source.settings.maxFileSizeMb}MB / {source.settings.maxPages} pages
                </p>
                <p className="rounded bg-slate-50 px-2 py-1">
                  Dedupe: {source.settings.dedupeStrategy} | Change: {source.settings.changeDetection}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
