import { ParsedWalletItem, ChainAsset } from '../types/wallet';
import { logger } from './logger';

const DB_NAME = 'JmbtWeb3WalletDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallets';
const LEGACY_STORAGE_KEY = 'jmbt_wallets_v2';
const OLD_LEGACY_STORAGE_KEY = 'jmbt_wallets';

/**
 * Open or initialize IndexedDB
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung oleh browser ini'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sanitize wallet objects before saving (strip zero/empty assets if needed)
 */
function sanitizeWallet(w: ParsedWalletItem): ParsedWalletItem {
  const compactAssets: Record<string, ChainAsset> = {};
  for (const [k, v] of Object.entries(w.chainAssets || {})) {
    if (v.hasBalance || v.status === 'success' || v.status === 'error') {
      compactAssets[k] = v;
    }
  }
  return {
    ...w,
    chainAssets: compactAssets,
  };
}

let saveDebounceTimer: any = null;

/**
 * Save all wallets to IndexedDB (with 400ms debounce to prevent high-frequency write lock during fast scans)
 */
export function saveWalletsToStorage(wallets: ParsedWalletItem[]): Promise<void> {
  return new Promise((resolve) => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }

    saveDebounceTimer = setTimeout(async () => {
      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Clear existing and write all in a single transaction
        store.clear();
        for (const wallet of wallets) {
          store.put(sanitizeWallet(wallet));
        }

        tx.oncomplete = () => {
          // Clean up legacy localStorage if it was exceeding quota
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            localStorage.removeItem(OLD_LEGACY_STORAGE_KEY);
          } catch {
            // ignore
          }
          resolve();
        };

        tx.onerror = (e) => {
          console.error('IndexedDB transaction error:', e);
          resolve();
        };
      } catch (err: any) {
        // Fallback to local storage if IndexedDB fails
        try {
          const small = wallets.slice(0, 100);
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(small.map(sanitizeWallet)));
        } catch {
          logger.warn('SYSTEM', `Peringatan penyimpanan: ${err.message}`);
        }
        resolve();
      }
    }, 400);
  });
}

/**
 * Load all wallets from IndexedDB (with automatic migration from legacy localStorage)
 */
export async function loadWalletsFromStorage(): Promise<ParsedWalletItem[]> {
  try {
    const db = await openDatabase();
    const wallets = await new Promise<ParsedWalletItem[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });

    if (wallets.length > 0) {
      return wallets;
    }
  } catch (err) {
    console.warn('IndexedDB read failed, checking localStorage fallback:', err);
  }

  // Check legacy localStorage for existing wallets to migrate
  try {
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(OLD_LEGACY_STORAGE_KEY);
    if (legacyData) {
      const parsed: ParsedWalletItem[] = JSON.parse(legacyData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        logger.info('SYSTEM', `Migrasi ${parsed.length} wallet dari localStorage ke IndexedDB (Unlimited Capacity)...`);
        // Migrate to IndexedDB
        saveWalletsToStorage(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error('Legacy migration parse error:', err);
  }

  return [];
}

/**
 * Clear all wallets from storage
 */
export async function clearWalletsStorage(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.error('Error clearing IndexedDB:', err);
  }

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(OLD_LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

