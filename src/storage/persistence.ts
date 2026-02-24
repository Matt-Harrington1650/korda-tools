export interface PersistenceAdapter<T> {
  load: () => T | null;
  save: (value: T) => void;
  clear: () => void;
}
