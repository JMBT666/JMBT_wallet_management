import { logger } from './logger';

export const DEFAULT_DRPC_KEYS = [
  'AlR5Bwaj40U5lG4A4leeg-jrohKrsHcR8b-XMrvp6PLd'
];

const DRPC_STORAGE_KEY = 'jmbt_drpc_keys_v1';
const DRPC_ENABLED_KEY = 'jmbt_drpc_enabled_v1';
let currentDrpcIndex = 0;

export function isDrpcEnabled(): boolean {
  try {
    const val = localStorage.getItem(DRPC_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveDrpcEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DRPC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Error saving dRPC enabled state:', err);
  }
}

export function getStoredDrpcKeys(): string[] {
  try {
    const raw = localStorage.getItem(DRPC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k) => typeof k === 'string' && k.trim().length > 0);
      }
    }
  } catch (err) {
    console.error('Error loading dRPC keys:', err);
  }
  return [...DEFAULT_DRPC_KEYS];
}

export function saveStoredDrpcKeys(keys: string[]): void {
  try {
    const clean = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    localStorage.setItem(DRPC_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.error('Error saving dRPC keys:', err);
  }
}

// Map chain IDs to dRPC slug path
const DRPC_CHAIN_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'holesky': 'holesky',
  'sepolia': 'sepolia',
  'bsc': 'bsc',
  'bsc-testnet': 'bsc-testnet',
  'polygon': 'polygon',
  'polygon-amoy': 'polygon-amoy',
  'arbitrum': 'arbitrum',
  'arbitrum-sepolia': 'arbitrum-sepolia',
  'base': 'base',
  'base-sepolia': 'base-sepolia',
  'optimism': 'optimism',
  'op-sepolia': 'optimism-sepolia',
  'avalanche': 'avalanche',
  'avalanche-fuji': 'avalanche-fuji',
};

export function getDrpcUrlForChain(chainId: string, key?: string): string | null {
  const slug = DRPC_CHAIN_MAP[chainId];
  if (!slug) return null;

  const targetKey = key || getNextDrpcKey().key;
  if (!targetKey) return null;

  if (targetKey.startsWith('http')) {
    return targetKey;
  }
  return `https://lb.drpc.live/${slug}/${targetKey}`;
}

export function getNextDrpcKey(): { key: string; index: number } {
  const keys = getStoredDrpcKeys();
  if (keys.length === 0) {
    return { key: DEFAULT_DRPC_KEYS[0], index: 0 };
  }
  const idx = currentDrpcIndex % keys.length;
  currentDrpcIndex = (currentDrpcIndex + 1) % keys.length;
  return { key: keys[idx], index: idx };
}

export function getAllDrpcUrlsForChain(chainId: string): string[] {
  const slug = DRPC_CHAIN_MAP[chainId];
  if (!slug) return [];
  const keys = getStoredDrpcKeys();
  return keys.map((k) => k.startsWith('http') ? k : `https://lb.drpc.live/${slug}/${k}`);
}

/**
 * Test health and latency of all configured dRPC keys on Ethereum Mainnet
 */
export async function testAllDrpcKeys(keysToTest?: string[]): Promise<
  { key: string; status: 'success' | 'error'; ms?: number; message?: string }[]
> {
  const keys = keysToTest && Array.isArray(keysToTest) ? keysToTest : getStoredDrpcKeys();
  const results = await Promise.all(
    keys.map(async (key) => {
      const url = key.startsWith('http') ? key : `https://lb.drpc.live/ethereum/${key}`;
      const start = performance.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - start);

        if (res.ok) {
          const json = await res.json();
          if (json && json.result) {
            return { key, status: 'success' as const, ms: elapsed, message: `OK (${elapsed}ms)` };
          } else {
            return { key, status: 'error' as const, message: json?.error?.message || 'Error' };
          }
        } else {
          return { key, status: 'error' as const, message: `HTTP ${res.status}` };
        }
      } catch (err: any) {
        return {
          key,
          status: 'error' as const,
          message: err.name === 'AbortError' ? 'Timeout (>6s)' : 'Network Error',
        };
      }
    })
  );

  return results;
}

