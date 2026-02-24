import { PageShell } from '../components/PageShell';
import { SettingsPanel } from '../features/settings/components/SettingsPanel';

export function SettingsPage() {
  return (
    <PageShell title="Settings" description="Project-level settings placeholder for future provider/plugin configuration.">
      <SettingsPanel />
    </PageShell>
  );
}
