import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckboxGroupField, SegmentedControl } from '../../components/structured';
import { ingestQueueSource } from '../../features/sophon/ingest/api';
import { useSophonStore } from '../../features/sophon/store/sophonStore';
import type { SophonSensitivity, SophonSourceType } from '../../features/sophon/types';

const SUPPORTED_EXTENSION_OPTIONS = [
  { value: '.pdf', label: 'PDF' },
  { value: '.docx', label: 'DOCX' },
  { value: '.dwg', label: 'DWG' },
  { value: '.dxf', label: 'DXF' },
  { value: '.ifc', label: 'IFC' },
  { value: '.xlsx', label: 'XLSX' },
  { value: '.csv', label: 'CSV' },
  { value: '.txt', label: 'TXT' },
  { value: '.jpg', label: 'JPG' },
  { value: '.png', label: 'PNG' },
  { value: '.md', label: 'Markdown' },
] as const;

const SOURCE_TYPE_OPTIONS: Array<{ value: SophonSourceType; label: string }> = [
  { value: 'folder', label: 'Folder' },
  { value: 'file', label: 'Single File' },
  { value: 'project_vault', label: 'Project Vault' },
];

const SENSITIVITY_OPTIONS: Array<{ value: SophonSensitivity; label: string }> = [
  { value: 'Public', label: 'Public' },
  { value: 'Internal', label: 'Internal' },
  { value: 'Confidential', label: 'Confidential' },
  { value: 'Client-Confidential', label: 'Client Confidential' },
];

type ScanDepth = 'root' | 'recursive';

export function SophonSourcesPage() {
  const sources = useSophonStore((store) => store.state.sources);
  const addSource = useSophonStore((store) => store.addSource);
  const removeSource = useSophonStore((store) => store.removeSource);
  const queryClient = useQueryClient();

  const [sourceType, setSourceType] = useState<SophonSourceType>('folder');
  const [scanDepth, setScanDepth] = useState<ScanDepth>('recursive');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(
    SUPPORTED_EXTENSION_OPTIONS.map((option) => option.value),
  );
  const [excludeTempFolders, setExcludeTempFolders] = useState(true);
  const [excludeOfficeTemp, setExcludeOfficeTemp] = useState(true);
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [sensitivity, setSensitivity] = useState<SophonSensitivity>('Internal');
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [extractionEnabled, setExtractionEnabled] = useState(true);
  const [pageAwareChunking, setPageAwareChunking] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const queueMutation = useMutation({
    mutationFn: ingestQueueSource,
    onSuccess: (result, variables) => {
      setFormError('');
      setFormMessage(`Queued "${variables.source.name}" as ${result.jobId} (${result.discoveredFiles} file(s)).`);
      void queryClient.invalidateQueries({ queryKey: ['sophon', 'ingest'] });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Failed to queue ingestion.');
    },
  });

  const sourceCount = sources.length;
  const watchCount = useMemo(() => sources.filter((item) => item.settings.watchEnabled).length, [sources]);
  const normalizedName = name.trim().toLowerCase();
  const normalizedPath = normalizePath(path);
  const duplicateSourceExists = sources.some(
    (item) => item.name.trim().toLowerCase() === normalizedName || normalizePath(item.path) === normalizedPath,
  );
  const generatedIncludePatterns = useMemo(
    () => buildIncludePatterns(selectedExtensions, scanDepth === 'recursive'),
    [scanDepth, selectedExtensions],
  );
  const generatedExcludePatterns = useMemo(
    () => buildExcludePatterns(excludeTempFolders, excludeOfficeTemp),
    [excludeOfficeTemp, excludeTempFolders],
  );
  const uniqueKnownPaths = useMemo(
    () => Array.from(new Set(sources.map((source) => source.path.trim()).filter((value) => value.length > 0))),
    [sources],
  );

  const saveSource = (): void => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    const allowedExtensions = normalizeExtensions(selectedExtensions);
    const include = buildIncludePatterns(allowedExtensions, scanDepth === 'recursive');
    const exclude = buildExcludePatterns(excludeTempFolders, excludeOfficeTemp);

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
      ocrEnabled,
      extractionEnabled,
      pageAwareChunking,
      maxFileSizeMb: 1024,
      maxPages: 5000,
      tags: ['sophon', 'ingestion'],
      sensitivity,
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
          Structured source setup with generated include/exclude rules and explicit supported file types.
        </p>
        <div className="mt-3 space-y-3">
          <SegmentedControl
            label="Source Type"
            onChange={(value) => {
              setSourceType(value);
              setFormError('');
            }}
            options={SOURCE_TYPE_OPTIONS}
            value={sourceType}
          />
          {sourceType !== 'file' ? (
            <SegmentedControl
              label="Scan Depth"
              onChange={setScanDepth}
              options={[
                { value: 'root', label: 'Top Level' },
                { value: 'recursive', label: 'Recursive' },
              ]}
              value={scanDepth}
            />
          ) : null}
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
              list="sophon-known-source-paths"
              placeholder={sourceType === 'file' ? 'C:\\Projects\\Atlas\\basis-of-design.md' : 'D:\\KORDA\\Projects\\EPC-A'}
              value={path}
            />
            <datalist id="sophon-known-source-paths">
              {uniqueKnownPaths.map((knownPath) => (
                <option key={knownPath} value={knownPath} />
              ))}
            </datalist>
            <p className="text-xs text-[color:var(--kt-text-muted)]">
              Path entry remains freeform because this runtime does not expose a reliable absolute folder/file picker path across all targets.
            </p>
          </label>
          <CheckboxGroupField
            helperText="Only checked extensions are discoverable during enumerate."
            legend="Allowed File Types"
            onChange={(nextValues) => {
              setSelectedExtensions(nextValues);
              setFormError('');
            }}
            options={SUPPORTED_EXTENSION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            selectedValues={selectedExtensions}
          />
          <fieldset className="space-y-2">
            <legend className="kt-title-sm">Exclude Rules</legend>
            <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
              <input
                checked={excludeTempFolders}
                className="kt-checkbox"
                onChange={(event) => {
                  setExcludeTempFolders(event.target.checked);
                }}
                type="checkbox"
              />
              Exclude temporary folders (`tmp`, `.tmp`)
            </label>
            <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
              <input
                checked={excludeOfficeTemp}
                className="kt-checkbox"
                onChange={(event) => {
                  setExcludeOfficeTemp(event.target.checked);
                }}
                type="checkbox"
              />
              Exclude Office temporary files (`~$*`)
            </label>
          </fieldset>
          <label className="space-y-1">
            <span className="kt-title-sm">Sensitivity</span>
            <select
              className="kt-select"
              onChange={(event) => {
                setSensitivity(event.target.value as SophonSensitivity);
              }}
              value={sensitivity}
            >
              {SENSITIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="kt-title-sm">Processing Flags</legend>
            <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
              <input
                checked={ocrEnabled}
                className="kt-checkbox"
                onChange={(event) => {
                  setOcrEnabled(event.target.checked);
                }}
                type="checkbox"
              />
              Enable OCR
            </label>
            <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
              <input
                checked={extractionEnabled}
                className="kt-checkbox"
                onChange={(event) => {
                  setExtractionEnabled(event.target.checked);
                }}
                type="checkbox"
              />
              Enable extraction
            </label>
            <label className="kt-panel-muted flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]">
              <input
                checked={pageAwareChunking}
                className="kt-checkbox"
                onChange={(event) => {
                  setPageAwareChunking(event.target.checked);
                }}
                type="checkbox"
              />
              Enable page-aware chunking
            </label>
          </fieldset>
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
          <div className="kt-panel-muted px-3 py-2 text-xs text-[color:var(--kt-text-muted)]">
            <p className="font-medium text-[color:var(--kt-text-secondary)]">Generated Include Patterns</p>
            <p className="mt-1">{generatedIncludePatterns.join(', ') || 'None'}</p>
            <p className="mt-2 font-medium text-[color:var(--kt-text-secondary)]">Generated Exclude Patterns</p>
            <p className="mt-1">{generatedExcludePatterns.join(', ') || 'None'}</p>
          </div>
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
                      setFormError('');
                      queueMutation.mutate({
                        source,
                        options: {
                          dryRun,
                          safeMode,
                          maxWorkers: 1,
                        },
                      });
                    }}
                    type="button"
                  >
                    {queueMutation.isPending ? 'Queueing...' : 'Queue Ingestion'}
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

const normalizeExtensions = (values: string[]): string[] => {
  const unique = new Set<string>();
  values
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .forEach((item) => {
      unique.add(item.startsWith('.') ? item : `.${item}`);
    });
  return Array.from(unique);
};

const buildIncludePatterns = (extensions: string[], recursive: boolean): string[] => {
  if (extensions.length === 0) {
    return [];
  }

  const patterns = extensions.flatMap((extension) => {
    const suffix = extension.startsWith('.') ? extension.slice(1) : extension;
    const rootPattern = `*.${suffix}`;
    return recursive ? [rootPattern, `**/*.${suffix}`] : [rootPattern];
  });
  return Array.from(new Set(patterns));
};

const buildExcludePatterns = (excludeTempFolders: boolean, excludeOfficeTemp: boolean): string[] => {
  const patterns: string[] = [];
  if (excludeTempFolders) {
    patterns.push('**/tmp/**', '**/.tmp/**');
  }
  if (excludeOfficeTemp) {
    patterns.push('**/~$*');
  }
  return patterns;
};

const normalizePath = (value: string): string => value.trim().replaceAll('\\', '/').toLowerCase();
