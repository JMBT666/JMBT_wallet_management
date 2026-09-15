import { Connection } from '@solana/web3.js';
import { logger } from './logger';

export const DEFAULT_HELIUS_KEYS = [
  'ed0de9ee-57bc-4096-8bf7-674d953d7a9a',
  '32dda240-06fe-4c43-baa1-754938ec2bde',
  '19384a06-42a5-4650-8b44-c79e189e8db2',
  'd9d1446b-eaf7-426e-9e89-31f8f0e3f406',
  '14a99a00-b5d3-4087-98ea-201ea17f469e'
];

const HELIUS_STORAGE_KEY = 'jmbt_helius_keys_v1';
let currentKeyIndex = 0;

export function getStoredHeliusKeys(): string[] {
  try {
    const raw = localStorage.getItem(HELIUS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k) => typeof k === 'string' && k.trim().length > 0);
      }
    }
  } catch (err) {
    console.error('Error loading Helius keys:', err);
  }
  return [...DEFAULT_HELIUS_KEYS];
}

export function saveStoredHeliusKeys(keys: string[]): void {
  try {
    const clean = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    localStorage.setItem(HELIUS_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.error('Error saving Helius keys:', err);
  }
}

export function getNextHeliusRpcUrl(): { url: string; key: string; index: number } {
  const keys = getStoredHeliusKeys();
  if (keys.length === 0) {
    return {
      url: `https://mainnet.helius-rpc.com/?api-key=${DEFAULT_HELIUS_KEYS[0]}`,
      key: DEFAULT_HELIUS_KEYS[0],
      index: 0
    };
  }

  const idx = currentKeyIndex % keys.length;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  const key = keys[idx];

  // If user pasted a full URL or key
  const url = key.startsWith('http')
    ? key
    : `https://mainnet.helius-rpc.com/?api-key=${key}`;

  return { url, key, index: idx };
}

export function getAllHeliusRpcUrls(): string[] {
  const keys = getStoredHeliusKeys();
  return keys.map((key) =>
    key.startsWith('http') ? key : `https://mainnet.helius-rpc.com/?api-key=${key}`
  );
}

export function getRotatingHeliusConnection(commitment: 'confirmed' | 'finalized' = 'confirmed'): {
  connection: Connection;
  url: string;
  keyIndex: number;
} {
  const { url, index } = getNextHeliusRpcUrl();
  const connection = new Connection(url, commitment);
  return { connection, url, keyIndex: index };
}

/**
 * Execute a Solana operation with automatic round-robin retry across the Helius key pool
 */
export async function executeWithHeliusRotation<T>(
  operation: (connection: Connection, rpcUrl: string, keyIndex: number) => Promise<T>,
  maxAttempts?: number
): Promise<T> {
  const keys = getStoredHeliusKeys();
  const attempts = maxAttempts || Math.max(keys.length, 3);
  let lastError: any = null;

  for (let i = 0; i < attempts; i++) {
    const { url, index } = getNextHeliusRpcUrl();
    const connection = new Connection(url, 'confirmed');

    try {
      return await operation(connection, url, index + 1);
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('rate limit');
      logger.warn(
        'RPC',
        `[Helius #${index + 1}] ${isRateLimit ? 'Rate limit (429)' : err.message || 'Error'}. Merotasi ke Helius key berikutnya...`
      );
    }
  }

  throw lastError || new Error('All Helius rotating endpoints failed');
}

/**
 * Test latency and health of all configured Helius keys
 */
export async function testAllHeliusKeys(): Promise<
  { key: string; status: 'success' | 'error'; ms?: number; message?: string }[]
> {
  const keys = getStoredHeliusKeys();
  const results = await Promise.all(
    keys.map(async (key) => {
      const url = key.startsWith('http')
        ? key
        : `https://mainnet.helius-rpc.com/?api-key=${key}`;
      const start = performance.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - start);

        if (res.ok) {
          return { key, status: 'success' as const, ms: elapsed, message: `OK (${elapsed}ms)` };
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

