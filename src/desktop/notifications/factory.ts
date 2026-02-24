import { isTauriRuntime } from '../../lib/runtime';
import type { NotificationService } from './NotificationService';
import { TauriNotificationService } from './TauriNotificationService';
import { WebNotificationService } from './WebNotificationService';

export const createNotificationService = (): NotificationService => {
  if (isTauriRuntime()) {
    return new TauriNotificationService();
  }

  return new WebNotificationService();
};
