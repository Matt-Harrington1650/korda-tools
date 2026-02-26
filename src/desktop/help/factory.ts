import { isTauriRuntime } from '../../lib/runtime';
import type { HelpCenterService } from './HelpCenterService';
import { TauriHelpCenterService } from './TauriHelpCenterService';
import { WebHelpCenterService } from './WebHelpCenterService';

export const createHelpCenterService = (): HelpCenterService => {
  if (isTauriRuntime()) {
    return new TauriHelpCenterService();
  }

  return new WebHelpCenterService();
};
