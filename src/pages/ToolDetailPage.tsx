import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { EmptyState } from '../components/EmptyState';
import { createSecretVault } from '../desktop';
import type { CredentialRef } from '../domain/credential';
import { createCredentialRef, listCredentialRefs, upsertCredentialRef } from '../features/credentials/credentialService';
import { useToolExecution } from '../features/tools/hooks';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import {
  createDefaultPluginConfig,
  mapLegacyToolToPluginConfig,
  pluginRegistry,
  projectPluginConfigToLegacy,
  validatePluginConfig,
} from '../plugins';
import { authTypeSchema, toolStatusSchema, toolTypeSchema } from '../schemas/tool';

const toolDetailFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(240),
  category: z.string().trim().min(1, 'Category is required').max(40),
  toolType: toolTypeSchema,
  authType: authTypeSchema,
  customHeaderName: z.string().trim(),
  credentialMode: z.enum(['existing', 'new']),
  credentialRefId: z.string().trim(),
  credentialLabel: z.string().trim(),
  credentialSecret: z.string(),
  rotateSecret: z.string(),
  tags: z.string().trim(),
  status: toolStatusSchema,
}).superRefine((value, context) => {
  if (value.authType === 'custom_header' && value.customHeaderName.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customHeaderName'],
      message: 'Custom header name is required.',
    });
  }

  if (value.authType !== 'none') {
    if (value.credentialMode === 'existing' && value.credentialRefId.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credentialRefId'],
        message: 'Select an existing credential.',
      });
    }

    if (value.credentialMode === 'new') {
      if (value.credentialLabel.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['credentialLabel'],
          message: 'Credential label is required.',
        });
      }

      if (value.credentialSecret.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['credentialSecret'],
          message: 'Secret value is required for a new credential.',
        });
      }
    }
  }
});

type ToolDetailFormValues = z.infer<typeof toolDetailFormSchema>;

const toTagText = (tags: string[]): string => tags.join(', ');

export function ToolDetailPage() {
  const navigate = useNavigate();
  const { toolId } = useParams<{ toolId: string }>();
  const getToolById = useToolRegistryStore((state) => state.getToolById);
  const updateTool = useToolRegistryStore((state) => state.updateTool);
  const deleteTool = useToolRegistryStore((state) => state.deleteTool);
  const [credentials, setCredentials] = useState<CredentialRef[]>([]);
  const [submitError, setSubmitError] = useState('');
  const secretVault = createSecretVault();

  const tool = toolId ? getToolById(toolId) : undefined;

  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ToolDetailFormValues>({
    resolver: zodResolver(toolDetailFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      toolType: 'rest_api',
      authType: 'none',
      customHeaderName: '',
      credentialMode: 'existing',
      credentialRefId: '',
      credentialLabel: '',
      credentialSecret: '',
      rotateSecret: '',
      tags: '',
      status: 'configured',
    },
  });
  const [pluginConfig, setPluginConfig] = useState<Record<string, unknown>>(createDefaultPluginConfig('rest_api'));
  const [pluginErrors, setPluginErrors] = useState<string[]>([]);
  const previousToolTypeRef = useRef<string>('rest_api');

  useEffect(() => {
    if (!tool) {
      return;
    }

    reset({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      toolType: tool.type,
      authType: tool.authType,
      customHeaderName: tool.customHeaderName ?? '',
      credentialMode: 'existing',
      credentialRefId: tool.credentialRefId ?? '',
      credentialLabel: '',
      credentialSecret: '',
      rotateSecret: '',
      tags: toTagText(tool.tags),
      status: tool.status,
    });
    setPluginConfig(tool.config && Object.keys(tool.config).length > 0 ? tool.config : mapLegacyToolToPluginConfig(tool));
    setPluginErrors([]);
    previousToolTypeRef.current = tool.type;
  }, [reset, tool]);

  useEffect(() => {
    let mounted = true;

    void listCredentialRefs().then((items) => {
      if (mounted) {
        setCredentials(items);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedToolType = watch('toolType');
  const selectedAuthType = watch('authType');
  const credentialMode = watch('credentialMode');
  const selectedCredentialRefId = watch('credentialRefId');
  const selectedPluginManifest = pluginRegistry.getManifestByToolType(selectedToolType);
  const ConfigPanel = selectedPluginManifest?.ui?.ConfigPanel;

  useEffect(() => {
    if (previousToolTypeRef.current === selectedToolType) {
      return;
    }

    previousToolTypeRef.current = selectedToolType;
    setPluginErrors([]);
    setPluginConfig(createDefaultPluginConfig(selectedToolType));
  }, [selectedToolType]);
  const {
    executeAction,
    cancelExecution,
    isExecuting,
    activeAction,
    lastResult,
    executionStatus,
    progress,
    streamedOutput,
    attachments,
    fileMessage,
    fileError,
    isExportingOutput,
    durationMs,
    logs,
    addAttachments,
    removeAttachment,
    clearAttachments,
    exportRunOutput,
  } = useToolExecution(tool);
  const executionManifest = tool ? pluginRegistry.getManifestByToolType(tool.type) : null;
  const executionSupportsFiles = executionManifest?.capabilities.supportsFiles === true;
  const credentialOptions = useMemo(() => {
    const options = [...credentials];

    if (selectedCredentialRefId && !options.some((credential) => credential.id === selectedCredentialRefId)) {
      options.unshift({
        id: selectedCredentialRefId,
        provider: 'unknown',
        label: `Unknown credential (${selectedCredentialRefId})`,
        createdAt: Date.now(),
        lastUsedAt: null,
      });
    }

    return options;
  }, [credentials, selectedCredentialRefId]);

  const onSubmit = async (values: ToolDetailFormValues): Promise<void> => {
    if (!tool) {
      return;
    }

    setSubmitError('');
    setPluginErrors([]);

    if (!selectedPluginManifest) {
      setSubmitError(`Plugin for tool type "${values.toolType}" is not registered.`);
      return;
    }

    let credentialRefId: string | undefined;

    if (values.authType !== 'none') {
      if (values.credentialMode === 'new') {
        const nextCredential = createCredentialRef(values.credentialLabel.trim(), 'keyring');

        try {
          await secretVault.setSecret(nextCredential.id, values.credentialSecret);
          await upsertCredentialRef(nextCredential);
          credentialRefId = nextCredential.id;
          setCredentials((current) => [nextCredential, ...current.filter((entry) => entry.id !== nextCredential.id)]);
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'Failed to save credential secret.');
          return;
        }
      } else {
        credentialRefId = values.credentialRefId.trim();

        if (values.rotateSecret.trim().length > 0) {
          try {
            await secretVault.setSecret(credentialRefId, values.rotateSecret);
          } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to rotate secret.');
            return;
          }
        }
      }
    }

    const nextPluginErrors = validatePluginConfig(values.toolType, pluginConfig);
    if (nextPluginErrors.length > 0) {
      setPluginErrors(nextPluginErrors);
      return;
    }

    const configResult = selectedPluginManifest.configSchema.safeParse(pluginConfig);
    if (!configResult.success) {
      setPluginErrors(configResult.error.issues.map((issue) => issue.message));
      return;
    }

    const normalizedConfig = configResult.data as Record<string, unknown>;
    const projection = projectPluginConfigToLegacy(values.toolType, normalizedConfig);

    updateTool(tool.id, {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      type: values.toolType,
      authType: values.authType,
      credentialRefId,
      customHeaderName: values.authType === 'custom_header' ? values.customHeaderName.trim() : undefined,
      configVersion: selectedPluginManifest.version,
      config: normalizedConfig,
      ...projection,
      tags: values.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      status: values.authType !== 'none' && !credentialRefId ? 'missing_credentials' : values.status,
    });
  };

  const handleDelete = (): void => {
    if (!tool) {
      return;
    }

    const confirmed = window.confirm(`Delete tool "${tool.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    deleteTool(tool.id);
    navigate('/');
  };

  if (!toolId) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Invalid tool route</h2>
        <p className="mt-2 text-sm text-slate-600">Tool ID was not provided in the URL.</p>
      </section>
    );
  }

  if (!tool) {
    return (
      <EmptyState
        action={
          <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/">
            Back to Dashboard
          </Link>
        }
        message="This tool does not exist or was removed."
        title="Tool not found"
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{tool.name}</h2>
            <p className="text-sm text-slate-600">Edit configuration and manage this tool.</p>
          </div>
          <button
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
            onClick={handleDelete}
            type="button"
          >
            Delete Tool
          </button>
        </div>

        <h3 className="mb-3 text-base font-semibold text-slate-900">Configuration</h3>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('name')} />
              <p className="text-xs text-rose-600">{errors.name?.message}</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('category')} />
              <p className="text-xs text-rose-600">{errors.category?.message}</p>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} {...register('description')} />
            <p className="text-xs text-rose-600">{errors.description?.message}</p>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tool Type</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('toolType')}>
                <option value="rest_api">REST API</option>
                <option value="openai_compatible">OpenAI-compatible</option>
                <option value="webhook">Webhook</option>
                <option value="custom_plugin">Custom plugin</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Auth Type</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('authType')}>
                <option value="none">None</option>
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer</option>
                <option value="custom_header">Custom Header</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('status')}>
                <option value="configured">Configured</option>
                <option value="missing_credentials">Missing credentials</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>

          {selectedAuthType === 'custom_header' ? (
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Custom Header Name</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="X-API-Key" {...register('customHeaderName')} />
              <p className="text-xs text-rose-600">{errors.customHeaderName?.message}</p>
            </label>
          ) : null}

          {selectedAuthType !== 'none' ? (
            <div className="space-y-3 rounded-md border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Credential</h4>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Credential Source</span>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialMode')}>
                  <option value="existing">Use existing</option>
                  <option value="new">Create new</option>
                </select>
              </label>

              {credentialMode === 'existing' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Existing Credential</span>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialRefId')}>
                      <option value="">Select credential</option>
                      {credentialOptions.map((credential) => (
                        <option key={credential.id} value={credential.id}>
                          {credential.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-rose-600">{errors.credentialRefId?.message}</p>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Rotate Secret (optional)</span>
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" {...register('rotateSecret')} />
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Credential Label</span>
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialLabel')} />
                    <p className="text-xs text-rose-600">{errors.credentialLabel?.message}</p>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Secret Value</span>
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" {...register('credentialSecret')} />
                    <p className="text-xs text-rose-600">{errors.credentialSecret?.message}</p>
                  </label>
                </div>
              )}
            </div>
          ) : null}

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('tags')} />
            <p className="text-xs text-slate-500">Comma-separated tags.</p>
          </label>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900">Plugin Configuration</h4>
            {ConfigPanel ? (
              <ConfigPanel
                disabled={isSubmitting}
                errors={pluginErrors}
                onChange={(next) => {
                  setPluginConfig(next);
                }}
                value={pluginConfig}
              />
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No plugin config panel registered for this tool type.
              </p>
            )}
          </div>

          <button
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Save Changes
          </button>
          {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Execution</h3>
        <p className="mt-1 text-sm text-slate-600">Run execution through the adapter pipeline.</p>
        {executionSupportsFiles ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isExecuting}
                onClick={() => {
                  void addAttachments();
                }}
                type="button"
              >
                Attach Files
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isExecuting || attachments.length === 0}
                onClick={clearAttachments}
                type="button"
              >
                Clear Files
              </button>
            </div>
            {attachments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {attachments.map((file) => (
                  <li className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-xs" key={file.id}>
                    <span className="truncate text-slate-700">
                      {file.name} ({file.size} bytes)
                    </span>
                    <button
                      className="rounded border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                      disabled={isExecuting}
                      onClick={() => {
                        removeAttachment(file.id);
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No files attached.</p>
            )}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isExecuting}
            onClick={() => {
              void executeAction('test');
            }}
            type="button"
          >
            {isExecuting && activeAction === 'test' ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isExecuting}
            onClick={() => {
              void executeAction('run');
            }}
            type="button"
          >
            {isExecuting && activeAction === 'run' ? 'Running...' : 'Run Tool'}
          </button>
          {isExecuting ? (
            <button
              className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
              onClick={cancelExecution}
              type="button"
            >
              Cancel
            </button>
          ) : null}
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isExecuting || isExportingOutput}
            onClick={() => {
              void exportRunOutput();
            }}
            type="button"
          >
            {isExportingOutput ? 'Exporting...' : 'Export Output'}
          </button>
        </div>
        {fileMessage ? <p className="mt-2 text-xs text-emerald-700">{fileMessage}</p> : null}
        {fileError ? <p className="mt-2 text-xs text-rose-700">{fileError}</p> : null}

        <div className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-3">
          <p>
            <span className="font-medium text-slate-900">Status:</span> {executionStatus}
          </p>
          <p>
            <span className="font-medium text-slate-900">Action:</span> {activeAction ? (activeAction === 'test' ? 'Test Connection' : 'Run Tool') : 'Idle'}
          </p>
          <p>
            <span className="font-medium text-slate-900">Duration:</span> {(isExecuting ? durationMs : lastResult?.durationMs ?? durationMs)} ms
          </p>
          {progress !== null ? (
            <p className="md:col-span-3">
              <span className="font-medium text-slate-900">Progress:</span> {progress}%
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live Output</p>
          {streamedOutput ? (
            <pre className="mt-2 max-h-56 overflow-auto rounded border border-slate-200 bg-slate-950 p-3 text-xs text-emerald-200">
              {streamedOutput}
            </pre>
          ) : (
            <p className="mt-2 rounded border border-slate-200 bg-white p-3 text-xs text-slate-500">No output yet.</p>
          )}
        </div>

        {lastResult ? (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              lastResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <p className="font-medium">{lastResult.ok ? 'Execution succeeded' : 'Execution failed'}</p>
            <p className="mt-1">Request: {lastResult.requestSummary || 'n/a'}</p>
            <p className="mt-1">Duration: {lastResult.durationMs} ms</p>
            {lastResult.ok ? (
              <>
                <p className="mt-1">Response: {lastResult.responseSummary}</p>
                <pre className="mt-2 overflow-auto rounded bg-white/70 p-2 text-xs">{lastResult.response.bodyPreview}</pre>
              </>
            ) : (
              <>
                <p className="mt-1">Error: {lastResult.error.message}</p>
                <pre className="mt-2 overflow-auto rounded bg-white/70 p-2 text-xs">{lastResult.error.details}</pre>
                {lastResult.error.stack ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium">Developer error stack</summary>
                    <pre className="mt-2 overflow-auto rounded bg-white/70 p-2 text-xs">{lastResult.error.stack}</pre>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Request / Response Logs</h3>
        {logs.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No runs recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {logs.map((log) => (
              <li className="rounded-md border border-slate-200 p-3" key={log.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {log.actionType === 'test' ? 'Test Connection' : 'Run Tool'} {log.success ? 'succeeded' : 'failed'}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {log.requestSummary.method} {log.requestSummary.url}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Status: {log.responseSummary.statusCode ?? 'n/a'} ({log.responseSummary.durationMs} ms)
                </p>
                <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{log.responseSummary.preview}</pre>
                {log.errorDetails ? (
                  <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs text-rose-700">{log.errorDetails}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
