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
    <section className="kt-panel p-4">
      <h3 className="kt-title-lg">Backup / Restore</h3>
      <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">
        Export or restore Sophon configuration, source definitions, index metadata, and audit state.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="kt-btn kt-btn-primary"
          onClick={handleExport}
          type="button"
        >
          Export Backup
        </button>
        <button
          className="kt-btn kt-btn-secondary"
          onClick={() => {
            handleImport(true);
          }}
          type="button"
        >
          Validate Import (Dry-Run)
        </button>
        <button
          className="kt-btn kt-btn-secondary"
          onClick={handleLogsExport}
          type="button"
        >
          Export Logs
        </button>
        <button
          className="kt-btn kt-btn-ghost"
          onClick={() => {
            handleImport(false);
          }}
          type="button"
        >
          Restore Backup
        </button>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="kt-title-sm">Backup JSON</span>
        <textarea
          className="kt-textarea h-72 font-mono text-xs"
          onChange={(event) => {
            setPayload(event.target.value);
          }}
          value={payload}
        />
      </label>
      {message ? <p className="mt-2 text-sm text-[color:var(--kt-text-secondary)]">{message}</p> : null}
    </section>
  );
}
