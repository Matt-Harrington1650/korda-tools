import { tauriInvoke } from '../../lib/tauri';
import type {
  HelpCenterService,
  HelpCreatePageInput,
  HelpPageRecord,
  HelpPageSummary,
  HelpUpdatePageInput,
} from './HelpCenterService';

export class TauriHelpCenterService implements HelpCenterService {
  listPages(): Promise<HelpPageSummary[]> {
    return tauriInvoke<HelpPageSummary[]>('help_list_pages');
  }

  getPage(slug: string): Promise<HelpPageRecord> {
    return tauriInvoke<HelpPageRecord>('help_get_page', {
      slug,
    });
  }

  createPage(input: HelpCreatePageInput): Promise<HelpPageRecord> {
    return tauriInvoke<HelpPageRecord>('help_create_page', {
      request: input,
    });
  }

  updatePage(slug: string, input: HelpUpdatePageInput): Promise<HelpPageRecord> {
    return tauriInvoke<HelpPageRecord>('help_update_page', {
      slug,
      request: input,
    });
  }

  deletePage(slug: string): Promise<void> {
    return tauriInvoke<void>('help_delete_page', {
      slug,
    });
  }

  getAppState(key: string): Promise<string | null> {
    return tauriInvoke<string | null>('app_state_get', {
      key,
    });
  }

  setAppState(key: string, value: string): Promise<void> {
    return tauriInvoke<void>('app_state_set', {
      key,
      value,
    });
  }
}
