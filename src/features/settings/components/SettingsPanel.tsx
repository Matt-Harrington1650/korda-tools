import { useToolRegistryStore } from '../../tools/store/toolRegistryStore';

export function SettingsPanel() {
  const resetToSeedData = useToolRegistryStore((state) => state.resetToSeedData);

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div>
        <h3 className="text-base font-semibold text-white">MVP Settings Placeholder</h3>
        <p className="mt-1 text-sm text-slate-400">
          Provider credentials, plugin controls, and execution limits will be added in future iterations.
        </p>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        This button resets local registry data back to seed defaults.
      </div>

      <button
        className="inline-flex rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
        onClick={() => {
          resetToSeedData();
        }}
        type="button"
      >
        Reset Seed Data
      </button>
    </div>
  );
}
