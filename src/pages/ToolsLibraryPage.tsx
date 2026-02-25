import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { customToolsLibraryService } from '../features/customToolsLibrary/service';
import { formatBytes, pickToolFiles } from '../features/customToolsLibrary/helpers';
import type { ImportZipPayloadInput, ImportZipPreview } from '../desktop';

const formatTimestamp = (value: number): string => {
  return new Date(value).toLocaleString();
};

export function ToolsLibraryPage() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Awaited<ReturnType<typeof customToolsLibraryService.listTools>>>([]);
  const [allTools, setAllTools] = useState<Awaited<ReturnType<typeof customToolsLibraryService.listTools>>>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ImportZipPreview | null>(null);
  const [previewPayload, setPreviewPayload] = useState<ImportZipPayloadInput | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAll = async (): Promise<void> => {
      try {
        const result = await customToolsLibraryService.listTools();
        if (mounted) {
          setAllTools(result);
        }
      } catch {
        // best effort for filter options
      }
    };

    void loadAll();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const result = await customToolsLibraryService.listTools({
          query: query.trim() || undefined,
          category: category || undefined,
          tag: tag || undefined,
        });

        if (mounted) {
          setTools(result);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load custom tools.');
          setTools([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [category, query, tag]);

  const categories = useMemo(() => {
    return Array.from(new Set(allTools.map((tool) => tool.category))).sort((left, right) => left.localeCompare(right));
  }, [allTools]);

  const tags = useMemo(() => {
    return Array.from(new Set(allTools.flatMap((tool) => tool.tags))).sort((left, right) => left.localeCompare(right));
  }, [allTools]);

  const handleImport = async (): Promise<void> => {
    setImportError('');
    setImportMessage('');
    setPreview(null);
    setPreviewPayload(null);

    try {
      const files = await pickToolFiles({ multiple: false, acceptZipOnly: true });
      const selected = files[0];
      if (!selected) {
        return;
      }

      const payload = {
        fileName: selected.originalName,
        dataBase64: selected.dataBase64,
      };

      const importPreview = await customToolsLibraryService.previewImportZipPayload(payload);
      setPreview(importPreview);
      setPreviewPayload(payload);
    } catch (importLoadError) {
      setImportError(importLoadError instanceof Error ? importLoadError.message : 'Failed to read import zip.');
    }
  };

  const handleConfirmImport = async (): Promise<void> => {
    if (!previewPayload) {
      return;
    }

    setIsImporting(true);
    setImportError('');
    setImportMessage('');

    try {
      const result = await customToolsLibraryService.importZipPayload(previewPayload);
      setImportMessage('Import completed successfully.');
      setPreview(null);
      setPreviewPayload(null);
      navigate(`/tools/${result.toolId}`);
    } catch (importErrorValue) {
      setImportError(importErrorValue instanceof Error ? importErrorValue.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Custom Tools Library</h2>
            <p className="mt-1 text-sm text-slate-600">Manage packaged tool files, versioned instructions, and shareable exports.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => {
                void handleImport();
              }}
              type="button"
            >
              Import
            </button>
            <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/tools/new">
              Add Tool
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Search</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Name, description, tags"
              value={query}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setCategory(event.target.value);
              }}
              value={category}
            >
              <option value="">All categories</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tag</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setTag(event.target.value);
              }}
              value={tag}
            >
              <option value="">Any tag</option>
              {tags.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {importMessage ? <p className="mt-3 text-sm text-emerald-700">{importMessage}</p> : null}
        {importError ? <p className="mt-3 text-sm text-rose-700">{importError}</p> : null}
      </section>

      {preview ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Import Preview</h3>
              <p className="mt-1 text-sm text-slate-700">
                {preview.toolName} ({preview.slug}) v{preview.version}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setPreview(null);
                  setPreviewPayload(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
                disabled={isImporting}
                onClick={() => {
                  void handleConfirmImport();
                }}
                type="button"
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600">Total size: {formatBytes(preview.totalSizeBytes)}</p>
          <ul className="mt-3 space-y-2">
            {preview.files.map((file) => (
              <li className="rounded border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700" key={file.originalName}>
                {file.originalName} - {formatBytes(file.sizeBytes)}
              </li>
            ))}
          </ul>
          {preview.warnings.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        {loading ? <p className="text-sm text-slate-600">Loading tools...</p> : null}
        {!loading && error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {!loading && !error && tools.length === 0 ? (
          <EmptyState
            action={
              <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/tools/new">
                Add Tool
              </Link>
            }
            message="Try changing search/filter settings or add a new custom tool package."
            title="No custom tools found"
          />
        ) : null}

        {tools.map((tool) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4" key={tool.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{tool.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded bg-slate-100 px-2 py-1 font-medium">{tool.category}</span>
                  {tool.tags.map((toolTag) => (
                    <span className="rounded bg-slate-50 px-2 py-1" key={`${tool.id}-${toolTag}`}>
                      #{toolTag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">Latest version: {tool.latestVersion?.version ?? 'n/a'}</p>
                <p className="text-xs text-slate-500">Updated: {formatTimestamp(tool.updatedAt)}</p>
                <Link
                  className="mt-2 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  to={`/tools/${tool.id}`}
                >
                  Open
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
