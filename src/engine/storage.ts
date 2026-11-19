/**
 * The only thing the engine needs from the outside world to save. The
 * browser's `localStorage` fits this shape, so does a test double.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A plain in-memory store. Used as the fallback and in tests. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** The browser's localStorage, or null when it cannot be reached (private mode, blocked, no DOM). */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export interface Persistence {
  /** Read the raw text, or null when nothing is saved. */
  read(): string | null;
  /** Write the raw text. Never throws. */
  write(text: string): void;
  remove(): void;
  /** False once saving has fallen back to memory. The UI can show its calm notice. */
  isPersistent(): boolean;
}

/**
 * Wraps a storage with a fallback to memory. If the storage is missing or any
 * call on it throws, the wrapper keeps working from memory, flips
 * `isPersistent()` to false and calls `onFallback` once.
 */
export function createPersistence(
  key: string,
  storage: StorageLike | null,
  onFallback?: () => void,
): Persistence {
  let backend: StorageLike = storage ?? createMemoryStorage();
  let persistent = storage !== null;
  if (!persistent) queueMicrotask(() => onFallback?.());

  function fallBack(carry: string | null) {
    if (!persistent) return;
    persistent = false;
    backend = createMemoryStorage();
    if (carry !== null) backend.setItem(key, carry);
    onFallback?.();
  }

  return {
    read() {
      try {
        return backend.getItem(key);
      } catch {
        fallBack(null);
        return null;
      }
    },
    write(text) {
      try {
        backend.setItem(key, text);
      } catch {
        fallBack(text);
      }
    },
    remove() {
      try {
        backend.removeItem(key);
      } catch {
        fallBack(null);
      }
    },
    isPersistent: () => persistent,
  };
}
