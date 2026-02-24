export interface StorageEngine<T> {
  load: () => T;
  save: (value: T) => void;
  clear: () => void;
}
