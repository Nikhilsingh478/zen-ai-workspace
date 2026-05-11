/**
 * Storage abstraction.
 *
 * Current (web/PWA): localStorage
 * Future (Tauri):    tauri-plugin-store → native JSON store with
 *                    file-system persistence, encryption support,
 *                    and cross-process access from Rust side
 *
 * All existing code that uses localStorage directly continues to work.
 * New code should use `platformStorage` so it works in all environments.
 */

export interface StorageService {
  get<T = unknown>(key: string): T | null;
  set<T = unknown>(key: string, value: T): void;
  remove(key: string): void;
  has(key: string): boolean;
  /** Returns all stored keys managed by this service. */
  keys(): string[];
}

// ── Browser implementation ────────────────────────────────────────────────────

class LocalStorageService implements StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn("[platform/storage] localStorage write failed for key:", key);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  keys(): string[] {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) result.push(k);
    }
    return result;
  }
}

// ── Future: Tauri implementation stub ─────────────────────────────────────────
// When running in Tauri, replace with tauri-plugin-store:
//
//   import { Store } from "@tauri-apps/plugin-store";
//   const store = new Store("ai-metrics.json");
//
//   class TauriStorageService implements StorageService {
//     get<T>(key: string) { return store.get<T>(key); }
//     set<T>(key: string, value: T) { store.set(key, value); store.save(); }
//     remove(key: string) { store.delete(key); store.save(); }
//     has(key: string) { return store.has(key); }
//     keys() { return store.keys(); }
//   }

// ── Factory ───────────────────────────────────────────────────────────────────

function createStorageService(): StorageService {
  // Future: if (Platform.isNative()) return new TauriStorageService();
  return new LocalStorageService();
}

export const platformStorage: StorageService = createStorageService();
