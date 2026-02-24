import type { NotificationService } from './NotificationService';

const getRuntimeNotification = (): typeof Notification | null => {
  const maybeNotification = (globalThis as typeof globalThis & { Notification?: typeof Notification }).Notification;
  if (typeof maybeNotification === 'undefined') {
    return null;
  }

  return maybeNotification;
};

export class TauriNotificationService implements NotificationService {
  async notify(title: string, body: string): Promise<void> {
    const NotificationApi = getRuntimeNotification();
    if (!NotificationApi) {
      return;
    }

    if (NotificationApi.permission === 'default') {
      const permission = await NotificationApi.requestPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    if (NotificationApi.permission === 'granted') {
      new NotificationApi(title, { body });
    }
  }
}
