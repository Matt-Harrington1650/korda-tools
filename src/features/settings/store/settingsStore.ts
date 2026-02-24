import { create } from 'zustand';
import type { Settings, SettingsFormValues } from '../../../domain/settings';
import { settingsFormSchema, settingsSchema, settingsSchemaVersion } from '../../../schemas/settingsSchemas';
import { createLocalStorageEngine } from '../../../storage/localStorageEngine';
import { migrateSettings } from '../../../storage/migrations';
import { STORAGE_KEYS } from '../../../storage/keys';

const defaultSettings: Settings = {
  version: settingsSchemaVersion,
  theme: 'system',
  defaultTimeoutMs: 10_000,
  localStoragePath: './local-data',
  providerDefaults: {
    openaiBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  credentialReferences: {
    openaiApiKeyRef: 'OPENAI_API_KEY',
    webhookSecretRef: 'WEBHOOK_SECRET',
    customHeaderRef: 'CUSTOM_HEADER_TOKEN',
  },
};

const persistence = createLocalStorageEngine({
  key: STORAGE_KEYS.settings,
  schema: settingsSchema,
  defaultValue: defaultSettings,
  migrate: migrateSettings,
});

const persistSettings = (settings: Settings): void => {
  persistence.save(settings);
};

type SettingsState = {
  settings: Settings;
  saveSettings: (values: SettingsFormValues) => Settings;
  resetSettings: () => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: persistence.load(),
  saveSettings: (values) => {
    const parsed = settingsFormSchema.parse(values);
    const nextSettings = settingsSchema.parse({
      version: settingsSchemaVersion,
      ...parsed,
    });

    // TODO(security): replace credential references with secure desktop secret storage integration.
    // TODO(storage): migrate local settings persistence to SQLite when desktop data layer is available.
    persistSettings(nextSettings);
    set({ settings: nextSettings });

    return nextSettings;
  },
  resetSettings: () => {
    persistSettings(defaultSettings);
    set({ settings: defaultSettings });
  },
}));
