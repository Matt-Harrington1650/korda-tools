import { SettingsPanel } from '../features/settings/components/SettingsPanel';

export function SettingsPage() {
  return (
    <section className="space-y-4">
      <div className="kt-panel-elevated p-6">
        <h2 className="kt-title-xl">Settings</h2>
        <p className="mt-1 text-sm text-[color:var(--kt-text-secondary)]">Manage persisted app preferences and provider defaults.</p>
      </div>
      <SettingsPanel />
    </section>
  );
}
