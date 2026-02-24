import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { createSecretVault } from '../desktop';
import type { CredentialRef } from '../domain/credential';
import { createCredentialRef, listCredentialRefs, upsertCredentialRef } from '../features/credentials/credentialService';
import { addToolFormSchema, type AddToolFormValues } from '../features/tools/forms';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';
import { createDefaultPluginConfig, pluginRegistry, projectPluginConfigToLegacy, validatePluginConfig } from '../plugins';

const defaultValues: AddToolFormValues = {
  name: '',
  description: '',
  category: 'general',
  toolType: 'rest_api',
  authType: 'none',
  customHeaderName: '',
  credentialMode: 'existing',
  credentialRefId: '',
  credentialLabel: '',
  credentialSecret: '',
  tags: '',
  status: 'configured',
};

export function AddToolPage() {
  const navigate = useNavigate();
  const addTool = useToolRegistryStore((state) => state.addTool);
  const [credentials, setCredentials] = useState<CredentialRef[]>([]);
  const [submitError, setSubmitError] = useState<string>('');
  const [pluginErrors, setPluginErrors] = useState<string[]>([]);
  const [pluginConfig, setPluginConfig] = useState<Record<string, unknown>>(createDefaultPluginConfig('rest_api'));
  const secretVault = createSecretVault();

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddToolFormValues>({
    resolver: zodResolver(addToolFormSchema),
    defaultValues,
  });

  const selectedToolType = watch('toolType');
  const selectedAuthType = watch('authType');
  const credentialMode = watch('credentialMode');
  const needsCredential = selectedAuthType !== 'none';
  const pluginManifest = pluginRegistry.getManifestByToolType(selectedToolType);
  const ConfigPanel = pluginManifest?.ui?.ConfigPanel;

  useEffect(() => {
    setPluginErrors([]);
    setPluginConfig(createDefaultPluginConfig(selectedToolType));
  }, [selectedToolType]);

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

  const onSubmit = async (values: AddToolFormValues): Promise<void> => {
    setSubmitError('');

    if (!pluginManifest) {
      setSubmitError(`Plugin for tool type "${values.toolType}" is not registered.`);
      return;
    }

    const nextPluginErrors = validatePluginConfig(values.toolType, pluginConfig);
    if (nextPluginErrors.length > 0) {
      setPluginErrors(nextPluginErrors);
      return;
    }

    const configResult = pluginManifest.configSchema.safeParse(pluginConfig);
    if (!configResult.success) {
      setPluginErrors(configResult.error.issues.map((issue) => issue.message));
      return;
    }

    setPluginErrors([]);

    const parsedTags = values.tags
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    let credentialRefId: string | undefined;

    if (needsCredential) {
      if (values.credentialMode === 'existing') {
        credentialRefId = values.credentialRefId.trim();
      } else {
        const newCredential = createCredentialRef(values.credentialLabel.trim(), 'keyring');

        try {
          await secretVault.setSecret(newCredential.id, values.credentialSecret);
          await upsertCredentialRef(newCredential);
          credentialRefId = newCredential.id;
          setCredentials((current) => [newCredential, ...current.filter((entry) => entry.id !== newCredential.id)]);
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'Failed to save credential secret.');
          return;
        }
      }
    }

    const normalizedConfig = configResult.data as Record<string, unknown>;
    const projection = projectPluginConfigToLegacy(values.toolType, normalizedConfig);

    addTool({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      type: values.toolType,
      authType: values.authType,
      credentialRefId,
      customHeaderName: values.authType === 'custom_header' ? values.customHeaderName.trim() : undefined,
      tags: parsedTags,
      status: needsCredential && !credentialRefId ? 'missing_credentials' : values.status,
      configVersion: pluginManifest.version,
      config: normalizedConfig,
      ...projection,
    });

    navigate('/');
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Add Tool</h2>
      <p className="mt-1 text-sm text-slate-600">Create a tool entry and save it to the local registry.</p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
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

        {needsCredential ? (
          <div className="space-y-3 rounded-md border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Credential</h3>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Credential Source</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialMode')}>
                <option value="existing">Use existing</option>
                <option value="new">Create new</option>
              </select>
            </label>

            {credentialMode === 'existing' ? (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Existing Credential</span>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialRefId')}>
                  <option value="">Select credential</option>
                  {credentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credential.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-rose-600">{errors.credentialRefId?.message}</p>
              </label>
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

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Plugin Configuration</h3>
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

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="tag1, tag2" {...register('tags')} />
          <p className="text-xs text-slate-500">Comma-separated values.</p>
        </label>

        <div className="flex items-center gap-3">
          <button
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Save Tool
          </button>
        </div>

        {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
      </form>
    </section>
  );
}
