export interface StorageEngine<T> {
  load: () => T | null;
  save: (value: T) => void;
  clear: () => void;
}
