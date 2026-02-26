import type {
  HelpCenterService,
  HelpCreatePageInput,
  HelpPageRecord,
  HelpPageSummary,
  HelpUpdatePageInput,
} from './HelpCenterService';

const unsupportedPromise = <T>(): Promise<T> => {
  return Promise.reject(new Error('Help Center requires Tauri desktop runtime.'));
};

export class WebHelpCenterService implements HelpCenterService {
  listPages(): Promise<HelpPageSummary[]> {
    return unsupportedPromise();
  }

  getPage(_slug: string): Promise<HelpPageRecord> {
    return unsupportedPromise();
  }

  createPage(_input: HelpCreatePageInput): Promise<HelpPageRecord> {
    return unsupportedPromise();
  }

  updatePage(_slug: string, _input: HelpUpdatePageInput): Promise<HelpPageRecord> {
    return unsupportedPromise();
  }

  deletePage(_slug: string): Promise<void> {
    return unsupportedPromise();
  }

  getAppState(_key: string): Promise<string | null> {
    return unsupportedPromise();
  }

  setAppState(_key: string, _value: string): Promise<void> {
    return unsupportedPromise();
  }
}
