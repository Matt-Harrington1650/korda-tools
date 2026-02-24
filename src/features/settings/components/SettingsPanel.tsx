import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SettingsFormValues } from '../../../domain/settings';
import { settingsFormSchema } from '../../../schemas/settingsSchemas';
import { useSettingsStore } from '../store';

export function SettingsPanel() {
  const settings = useSettingsStore((state) => state.settings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const [savedMessage, setSavedMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      theme: settings.theme,
      defaultTimeoutMs: settings.defaultTimeoutMs,
      localStoragePath: settings.localStoragePath,
      providerDefaults: settings.providerDefaults,
      credentialReferences: settings.credentialReferences,
    },
  });

  useEffect(() => {
    reset({
      theme: settings.theme,
      defaultTimeoutMs: settings.defaultTimeoutMs,
      localStoragePath: settings.localStoragePath,
      providerDefaults: settings.providerDefaults,
      credentialReferences: settings.credentialReferences,
    });
  }, [reset, settings]);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <form
        className="space-y-5"
        onSubmit={handleSubmit((values) => {
          saveSettings(values);
          setSavedMessage(`Saved at ${new Date().toLocaleTimeString()}`);
        })}
      >
        <div>
          <h3 className="text-base font-semibold text-slate-900">App Settings</h3>
          <p className="mt-1 text-sm text-slate-600">Typed settings persisted via local storage engine.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Theme</span>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('theme')}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="text-xs text-rose-600">{errors.theme?.message}</p>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Default Timeout (ms)</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              type="number"
              {...register('defaultTimeoutMs', { valueAsNumber: true })}
            />
            <p className="text-xs text-rose-600">{errors.defaultTimeoutMs?.message}</p>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Local Storage Path (placeholder)</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('localStoragePath')} />
          <p className="text-xs text-rose-600">{errors.localStoragePath?.message}</p>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">OpenAI Base URL</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('providerDefaults.openaiBaseUrl')} />
            <p className="text-xs text-rose-600">{errors.providerDefaults?.openaiBaseUrl?.message}</p>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Default Model</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('providerDefaults.defaultModel')} />
            <p className="text-xs text-rose-600">{errors.providerDefaults?.defaultModel?.message}</p>
          </label>
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-800">Credential References (no secret values)</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">OpenAI Key Ref</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialReferences.openaiApiKeyRef')} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Webhook Ref</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialReferences.webhookSecretRef')} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Header Ref</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('credentialReferences.customHeaderRef')} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Save Settings
          </button>
          <button
            className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              resetSettings();
              setSavedMessage('Settings reset to defaults.');
            }}
            type="button"
          >
            Reset Defaults
          </button>
          {savedMessage ? <span className="text-xs text-slate-600">{savedMessage}</span> : null}
        </div>
      </form>
    </div>
  );
}
