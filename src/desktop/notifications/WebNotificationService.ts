import type { NotificationService } from './NotificationService';

export class WebNotificationService implements NotificationService {
  async notify(_title: string, _body: string): Promise<void> {
    throw new Error('not supported');
  }
}
