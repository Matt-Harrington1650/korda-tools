import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { MarkdownPreview } from '../features/customToolsLibrary/MarkdownPreview';
import { customToolsLibraryService } from '../features/customToolsLibrary/service';
import { formatBytes, saveZipFromBase64 } from '../features/customToolsLibrary/helpers';

const formatTimestamp = (value: number): string => new Date(value).toLocaleString();

export function CustomToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Awaited<ReturnType<typeof customToolsLibraryService.getTool>> | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [exportingVersionId, setExportingVersionId] = useState('');

  useEffect(() => {
    if (!toolId) {
      setLoading(false);
      setError('Tool ID is missing from route.');
      return;
    }

    let mounted = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const detail = await customToolsLibraryService.getTool(toolId);
        if (!mounted) {
          return;
        }

        setTool(detail);
        if (detail.versions.length > 0) {
          setSelectedVersionId((current) => current || detail.versions[0].id);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load tool details.');
          setTool(null);
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
  }, [toolId]);

  const selectedVersion = useMemo(() => {
    if (!tool) {
      return null;
    }

    return tool.versions.find((version) => version.id === selectedVersionId) ?? tool.versions[0] ?? null;
  }, [selectedVersionId, tool]);

  const handleExportVersion = async (versionId: string): Promise<void> => {
    setMessage('');
    setError('');
    setExportingVersionId(versionId);

    try {
      const payload = await customToolsLibraryService.exportToolVersionZipPayload(versionId);
      await saveZipFromBase64(payload);
      setMessage('Version export saved.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export this version.');
    } finally {
      setExportingVersionId('');
    }
  };

  const handleCopySha = async (shaValue: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shaValue);
      setMessage('SHA-256 copied to clipboard.');
    } catch {
      setError('Clipboard access failed. Copy manually.');
    }
  };

  const handleDeleteTool = async (): Promise<void> => {
    if (!tool) {
      return;
    }

    const confirmed = window.confirm(`Delete tool "${tool.name}" and all versions?`);
    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await customToolsLibraryService.deleteTool(tool.id);
      navigate('/tools');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tool.');
    }
  };

  if (!toolId) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Invalid tool route</h2>
        <p className="mt-2 text-sm text-slate-600">Tool ID was not provided.</p>
      </section>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading tool details...</p>;
  }

  if (error && !tool) {
    return (
      <EmptyState
        action={
          <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/tools">
            Back to Tools Library
          </Link>
        }
        message={error}
        title="Tool could not be loaded"
      />
    );
  }

  if (!tool) {
    return (
      <EmptyState
        action={
          <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/tools">
            Back to Tools Library
          </Link>
        }
        message="The selected tool was not found."
        title="Tool not found"
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{tool.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded bg-slate-100 px-2 py-1 font-medium">{tool.category}</span>
              {tool.tags.map((tag) => (
                <span className="rounded bg-slate-50 px-2 py-1" key={`${tool.id}-tag-${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <button
            className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
            onClick={() => {
              void handleDeleteTool();
            }}
            type="button"
          >
            Delete Tool
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Versions</h3>
        {tool.versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No versions available.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Version</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Files</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tool.versions.map((version) => (
                  <tr key={version.id}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{version.version}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatTimestamp(version.createdAt)}</td>
                    <td className="py-2 pr-3 text-slate-600">{version.files.length}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setSelectedVersionId(version.id);
                          }}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-70"
                          disabled={exportingVersionId === version.id}
                          onClick={() => {
                            void handleExportVersion(version.id);
                          }}
                          type="button"
                        >
                          {exportingVersionId === version.id ? 'Exporting...' : 'Export'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedVersion ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Version {selectedVersion.version}</h3>
              <p className="text-sm text-slate-600">Created {formatTimestamp(selectedVersion.createdAt)}</p>
            </div>
            <button
              className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
              disabled={exportingVersionId === selectedVersion.id}
              onClick={() => {
                void handleExportVersion(selectedVersion.id);
              }}
              type="button"
            >
              {exportingVersionId === selectedVersion.id ? 'Exporting...' : 'Export this version'}
            </button>
          </div>

          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Instructions</p>
            <MarkdownPreview className="mt-2" markdown={selectedVersion.instructionsMd} />
          </div>

          <div className="mt-4 rounded border border-slate-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Files</p>
            {selectedVersion.files.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No files attached.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedVersion.files.map((file) => (
                  <li className="rounded border border-slate-200 bg-slate-50 p-3" key={file.id}>
                    <p className="text-sm font-medium text-slate-900">{file.originalName}</p>
                    <p className="mt-1 text-xs text-slate-600">Size: {formatBytes(file.sizeBytes)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white px-2 py-1 text-xs text-slate-700">{file.sha256}</code>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          void handleCopySha(file.sha256);
                        }}
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
