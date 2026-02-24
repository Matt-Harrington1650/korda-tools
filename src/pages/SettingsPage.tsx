import { SettingsPanel } from '../features/settings/components/SettingsPanel';

export function SettingsPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Manage persisted app preferences and provider defaults.</p>
      </div>
      <SettingsPanel />
    </section>
  );
}
