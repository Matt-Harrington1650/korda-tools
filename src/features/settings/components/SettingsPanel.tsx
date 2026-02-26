import { zodResolver } from '@hookform/resolvers/zod';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SettingsFormValues } from '../../../domain/settings';
import { createUpdaterService, type UpdateCheckResult } from '../../../desktop';
import { listCredentialRefs, replaceCredentialRefs } from '../../credentials/credentialService';
import {
  createDataExportPayload,
  createRestorePayload,
  parseDataExportPayload,
  serializeDataExportPayload,
} from '../backup/dataBackup';
import { useToolRegistryStore } from '../../tools/store/toolRegistryStore';
import { useToolRunLogStore } from '../../tools/store/toolRunLogStore';
import { useScheduledRunLogStore } from '../../workflows/store';
import { settingsFormSchema } from '../../../schemas/settingsSchemas';
import { useSettingsStore } from '../store';
import { helpCenterService } from '../../helpCenter/service';

export function SettingsPanel() {
  const settings = useSettingsStore((state) => state.settings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const replaceSettings = useSettingsStore((state) => state.replaceSettings);
  const tools = useToolRegistryStore((state) => state.tools);
  const replaceTools = useToolRegistryStore((state) => state.replaceTools);
  const logs = useToolRunLogStore((state) => state.entries);
  const replaceLogs = useToolRunLogStore((state) => state.replaceLogs);
  const scheduledRunLogs = useScheduledRunLogStore((state) => state.entries);
  const [savedMessage, setSavedMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerModeLoading, setDeveloperModeLoading] = useState(true);
  const [developerModeError, setDeveloperModeError] = useState('');
  const [developerModeMessage, setDeveloperModeMessage] = useState('');
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const updaterServiceRef = useRef(createUpdaterService());

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
      scheduler: settings.scheduler,
    },
  });

  useEffect(() => {
    reset({
      theme: settings.theme,
      defaultTimeoutMs: settings.defaultTimeoutMs,
      localStoragePath: settings.localStoragePath,
      providerDefaults: settings.providerDefaults,
      credentialReferences: settings.credentialReferences,
      scheduler: settings.scheduler,
    });
  }, [reset, settings]);

  useEffect(() => {
    let mounted = true;
    void helpCenterService
      .getAppState('developer_mode')
      .then((value) => {
        if (!mounted) {
          return;
        }
        setDeveloperMode(value?.toLowerCase() === 'true');
      })
      .catch(() => {
        if (mounted) {
          setDeveloperMode(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setDeveloperModeLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleExportData = async (): Promise<void> => {
    setBackupError('');
    setBackupMessage('');
    setIsExporting(true);

    try {
      const credentials = await listCredentialRefs();
      const payload = createDataExportPayload({
        tools,
        settings,
        logs,
        credentials,
      });
      const serialized = serializeDataExportPayload(payload);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replaceAll(':', '-');

      anchor.href = url;
      anchor.download = `korda-tools-export-${timestamp}.json`;
      anchor.click();

      URL.revokeObjectURL(url);
      setBackupMessage('Export completed.');
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setBackupError('');
    setBackupMessage('');
    setIsImporting(true);

    try {
      const fileContents = await selectedFile.text();
      const exportPayload = parseDataExportPayload(fileContents);
      const restored = createRestorePayload(exportPayload);

      replaceTools(restored.tools);
      replaceLogs(restored.logs);
      replaceSettings(restored.settings);
      await replaceCredentialRefs(restored.credentials);

      setBackupMessage('Restore completed. Tools requiring credentials are marked missing_credentials.');
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  const handleCheckUpdates = async (): Promise<void> => {
    setUpdateError('');
    setIsCheckingUpdates(true);

    try {
      const result = await updaterServiceRef.current.checkForUpdates();
      setUpdateResult(result);
    } catch (error) {
      setUpdateResult(null);
      setUpdateError(error instanceof Error ? error.message : 'Failed to check for updates.');
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleToggleDeveloperMode = async (enabled: boolean): Promise<void> => {
    setDeveloperModeError('');
    setDeveloperModeMessage('');
    try {
      await helpCenterService.setAppState('developer_mode', enabled ? 'true' : 'false');
      setDeveloperMode(enabled);
      setDeveloperModeMessage(enabled ? 'Developer Mode enabled.' : 'Developer Mode disabled.');
    } catch (error) {
      setDeveloperModeError(error instanceof Error ? error.message : 'Failed to update Developer Mode.');
    }
  };

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

        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-800">Scheduler (desktop only)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('scheduler.enabled')} />
              Enable scheduler service
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('scheduler.notificationsEnabled')} />
              Enable notifications
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('scheduler.notifyOnSuccess')} />
              Notify on success
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('scheduler.notifyOnFailure')} />
              Notify on failure
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

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Developer Mode</h4>
          <p className="mt-1 text-xs text-slate-600">
            Enables editing built-in Help Center pages and developer-facing documentation workflows.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            checked={developerMode}
            disabled={developerModeLoading}
            onChange={(event) => {
              void handleToggleDeveloperMode(event.target.checked);
            }}
            type="checkbox"
          />
          Enable Developer Mode
        </label>
        {developerModeMessage ? <p className="text-xs text-emerald-700">{developerModeMessage}</p> : null}
        {developerModeError ? <p className="text-xs text-rose-700">{developerModeError}</p> : null}
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">App Updates</h4>
          <p className="mt-1 text-xs text-slate-600">Check for a new desktop release through the Tauri updater plugin.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-70"
            disabled={isCheckingUpdates}
            onClick={() => {
              void handleCheckUpdates();
            }}
            type="button"
          >
            {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {updateResult ? (
          <div className="space-y-1 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
            {!updateResult.supportedRuntime ? (
              <p>{updateResult.notes}</p>
            ) : updateResult.available ? (
              <>
                <p className="font-medium text-emerald-700">Update available: {updateResult.latestVersion}</p>
                <p>Current version: {updateResult.currentVersion ?? 'n/a'}</p>
                {updateResult.publishedAt ? <p>Published: {new Date(updateResult.publishedAt).toLocaleString()}</p> : null}
                {updateResult.notes ? <pre className="mt-1 whitespace-pre-wrap">{updateResult.notes}</pre> : null}
              </>
            ) : (
              <p className="font-medium text-slate-700">No updates available. Current version: {updateResult.currentVersion ?? 'n/a'}</p>
            )}
          </div>
        ) : null}
        {updateError ? <p className="text-xs text-rose-700">{updateError}</p> : null}
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Data Export / Restore</h4>
          <p className="mt-1 text-xs text-amber-700">
            Secrets are not exported. After restore, tools that require credentials are marked missing_credentials until secrets are re-entered.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-70"
            disabled={isExporting || isImporting}
            onClick={() => {
              void handleExportData();
            }}
            type="button"
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>

          <button
            className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-70"
            disabled={isExporting || isImporting}
            onClick={() => {
              restoreInputRef.current?.click();
            }}
            type="button"
          >
            {isImporting ? 'Restoring...' : 'Restore Data'}
          </button>

          <input
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              void handleRestoreChange(event);
            }}
            ref={restoreInputRef}
            type="file"
          />
        </div>

        {backupMessage ? <p className="text-xs text-emerald-700">{backupMessage}</p> : null}
        {backupError ? <p className="text-xs text-rose-700">{backupError}</p> : null}
      </div>

      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Scheduled Run Logs</h4>
        {scheduledRunLogs.length === 0 ? (
          <p className="text-xs text-slate-600">No scheduled workflow runs recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {scheduledRunLogs.slice(0, 12).map((entry) => (
              <li className="rounded border border-slate-200 bg-white px-2 py-2 text-xs" key={entry.id}>
                <p className={`font-medium ${entry.status === 'succeeded' ? 'text-emerald-700' : 'text-rose-700'}`}>{entry.status}</p>
                <p className="text-slate-600">{new Date(entry.triggeredAt).toLocaleString()}</p>
                <p className="text-slate-700">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
