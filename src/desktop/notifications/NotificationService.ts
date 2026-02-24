export interface NotificationService {
  notify: (title: string, body: string) => Promise<void>;
}
