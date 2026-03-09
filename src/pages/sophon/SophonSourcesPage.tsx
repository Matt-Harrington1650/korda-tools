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
  const [includePatterns, setIncludePatterns] = useState('*.pdf,*.docx,**/*.pdf,**/*.docx');
  const [excludePatterns, setExcludePatterns] = useState('**/tmp/**,**/~$*');
  const [extensions, setExtensions] = useState('.pdf,.docx,.dwg,.dxf,.ifc,.xlsx,.csv,.txt,.jpg,.png');
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const sourceCount = sources.length;
  const watchCount = useMemo(() => sources.filter((item) => item.settings.watchEnabled).length, [sources]);
  const normalizedName = name.trim().toLowerCase();
  const normalizedPath = normalizePath(path);
  const duplicateSourceExists = sources.some(
    (item) => item.name.trim().toLowerCase() === normalizedName || normalizePath(item.path) === normalizedPath,
  );

  const saveSource = (): void => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    const include = splitList(includePatterns);
    const exclude = splitList(excludePatterns);
    const allowedExtensions = splitExtensions(extensions);

    if (!trimmedName || !trimmedPath) {
      setFormError('Name and path are required before saving a source.');
      return;
    }

    if (duplicateSourceExists) {
      setFormError('A source with this name or path already exists.');
      return;
    }

    if (include.length === 0) {
      setFormError('Provide at least one include pattern.');
      return;
    }

    if (allowedExtensions.length === 0) {
      setFormError('Provide at least one allowed extension (for example: .pdf,.docx,.txt).');
      return;
    }

    addSource({
      sourceType,
      name: trimmedName,
      path: trimmedPath,
      includePatterns: include,
      excludePatterns: exclude,
      allowedExtensions,
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
    setFormError('');
    setFormMessage(`Source "${trimmedName}" saved.`);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className="kt-panel p-4 xl:col-span-2">
        <h3 className="kt-title-lg">Add Source</h3>
        <p className="mt-1 text-xs text-[color:var(--kt-text-muted)]">
          Configure source rules for enumerate, extract, chunk, embed, index, validate, publish.
        </p>
        <div className="mt-3 space-y-3">
          <label className="space-y-1">
            <span className="kt-title-sm">Source Type</span>
            <select
              className="kt-select"
              onChange={(event) => {
                setSourceType(event.target.value as SophonSourceType);
                setFormError('');
              }}
              value={sourceType}
            >
              <option value="folder">Folder (Recursive)</option>
              <option value="file">Single File</option>
              <option value="project_vault">Project Vault</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="kt-title-sm">Name</span>
            <input
              className="kt-input"
              onChange={(event) => {
                setName(event.target.value);
                setFormError('');
              }}
              value={name}
            />
          </label>
          <label className="space-y-1">
            <span className="kt-title-sm">Path</span>
            <input
              className="kt-input"
              onChange={(event) => {
                setPath(event.target.value);
                setFormError('');
              }}
              placeholder="D:\\KORDA\\Projects\\EPC-A"
              value={path}
            />
          </label>
          <label className="space-y-1">
            <span className="kt-title-sm">Include Patterns</span>
            <input
              className="kt-input"
              onChange={(event) => {
                setIncludePatterns(event.target.value);
                setFormError('');
              }}
              value={includePatterns}
            />
          </label>
          <label className="space-y-1">
            <span className="kt-title-sm">Exclude Patterns</span>
            <input
              className="kt-input"
              onChange={(event) => {
                setExcludePatterns(event.target.value);
                setFormError('');
              }}
              value={excludePatterns}
            />
          </label>
          <label className="space-y-1">
            <span className="kt-title-sm">Allowed Extensions</span>
            <input
              className="kt-input"
              onChange={(event) => {
                setExtensions(event.target.value);
                setFormError('');
              }}
              value={extensions}
            />
          </label>
          <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
            <input
              className="kt-checkbox"
              checked={watchEnabled}
              onChange={(event) => {
                setWatchEnabled(event.target.checked);
              }}
              type="checkbox"
            />
            Enable watch mode (periodic scan + debounce)
          </label>
          <button
            className="kt-btn kt-btn-primary w-full"
            onClick={saveSource}
            type="button"
          >
            Save Source
          </button>
          {formError ? <p className="kt-panel-muted border-rose-400/40 px-2 py-1 text-xs text-[color:var(--kt-danger)]">{formError}</p> : null}
          {formMessage ? (
            <p className="kt-panel-muted border-emerald-400/40 px-2 py-1 text-xs text-[color:var(--kt-success)]">{formMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="kt-panel p-4 xl:col-span-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="kt-title-lg">Configured Sources</h3>
          <div className="flex gap-2 text-xs">
            <span className="kt-chip">Total: {sourceCount}</span>
            <span className="kt-chip kt-chip-accent">Watch: {watchCount}</span>
          </div>
        </div>

        <div className="kt-panel-muted mb-3 flex flex-wrap gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
          <label className="flex items-center gap-2">
            <input
              className="kt-checkbox"
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
              className="kt-checkbox"
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
            <p className="kt-panel-muted border-dashed px-3 py-3 text-sm text-[color:var(--kt-text-muted)]">
              No sources yet. Add one source and queue ingestion.
            </p>
          ) : null}

          {sources.map((source) => (
            <article key={source.id} className="kt-panel-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[color:var(--kt-text-primary)]">{source.name}</h4>
                  <p className="text-xs text-[color:var(--kt-text-muted)]">
                    {source.sourceType} - {source.path}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="kt-btn kt-btn-primary"
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
                    className="kt-btn kt-btn-danger"
                    onClick={() => {
                      removeSource(source.id);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-[color:var(--kt-text-secondary)] md:grid-cols-2">
                <p className="kt-kv">Include: {source.settings.includePatterns.join(', ')}</p>
                <p className="kt-kv">Exclude: {source.settings.excludePatterns.join(', ')}</p>
                <p className="kt-kv">
                  Chunk: {source.settings.chunkSize} / overlap {source.settings.chunkOverlap}
                </p>
                <p className="kt-kv">
                  Watch: {source.settings.watchEnabled ? `On (${source.settings.watchIntervalSec}s)` : 'Off'}
                </p>
                <p className="kt-kv">
                  Max: {source.settings.maxFileSizeMb}MB / {source.settings.maxPages} pages
                </p>
                <p className="kt-kv">
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

const splitExtensions = (value: string): string[] =>
  splitList(value).map((item) => (item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`));

const normalizePath = (value: string): string => value.trim().replaceAll('\\', '/').toLowerCase();
