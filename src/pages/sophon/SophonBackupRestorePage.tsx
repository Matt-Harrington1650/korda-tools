import { useState } from 'react';
import { useSophonStore } from '../../features/sophon/store/sophonStore';

export function SophonBackupRestorePage() {
  const exportBackupJson = useSophonStore((store) => store.exportBackupJson);
  const exportLogsBundle = useSophonStore((store) => store.exportLogsBundle);
  const importBackupJson = useSophonStore((store) => store.importBackupJson);
  const [payload, setPayload] = useState('');
  const [message, setMessage] = useState('');

  const handleExport = (): void => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sophon-backup-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setPayload(json);
    setMessage('Backup exported.');
  };

  const handleLogsExport = (): void => {
    const bundle = exportLogsBundle();
    const blob = new Blob([bundle], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sophon-logs-${Date.now()}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Logs bundle exported.');
  };

  const handleImport = (dryRun: boolean): void => {
    const result = importBackupJson(payload, dryRun);
    setMessage(result.message);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Backup / Restore</h3>
      <p className="mt-1 text-sm text-slate-600">
        Export or restore Sophon configuration, source definitions, index metadata, and audit state.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
          onClick={handleExport}
          type="button"
        >
          Export Backup
        </button>
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => {
            handleImport(true);
          }}
          type="button"
        >
          Validate Import (Dry-Run)
        </button>
        <button
          className="rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          onClick={handleLogsExport}
          type="button"
        >
          Export Logs
        </button>
        <button
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            handleImport(false);
          }}
          type="button"
        >
          Restore Backup
        </button>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium uppercase text-slate-600">Backup JSON</span>
        <textarea
          className="h-72 w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
          onChange={(event) => {
            setPayload(event.target.value);
          }}
          value={payload}
        />
      </label>
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
