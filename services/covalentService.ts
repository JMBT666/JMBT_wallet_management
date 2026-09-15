import { ChainConfig, TokenBalance } from '../types/wallet';
import { logger } from './logger';

export const DEFAULT_COVALENT_KEYS: string[] = [];

export const COVALENT_DEFAULT_API_KEY = '';
const COVALENT_SINGLE_STORAGE_KEY = 'jmbt_covalent_api_key_v1';
const COVALENT_MULTI_STORAGE_KEY = 'jmbt_covalent_api_keys_v2';
const COVALENT_ENABLED_KEY = 'jmbt_covalent_enabled_v1';
let currentCovalentIndex = 0;

export function getStoredCovalentKeys(): string[] {
  try {
    const multi = localStorage.getItem(COVALENT_MULTI_STORAGE_KEY);
    if (multi) {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k) => typeof k === 'string' && k.trim().length > 0);
      }
    }
    const single = localStorage.getItem(COVALENT_SINGLE_STORAGE_KEY);
    if (single && single.trim().length > 0) {
      return [single.trim()];
    }
  } catch (err) {
    console.error('Error loading Covalent keys:', err);
  }
  return [...DEFAULT_COVALENT_KEYS];
}

export function saveStoredCovalentKeys(keys: string[]): void {
  try {
    const clean = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    localStorage.setItem(COVALENT_MULTI_STORAGE_KEY, JSON.stringify(clean));
    if (clean.length > 0) {
      localStorage.setItem(COVALENT_SINGLE_STORAGE_KEY, clean[0]);
    }
  } catch (err) {
    console.error('Error saving Covalent keys:', err);
  }
}

export function getNextCovalentApiKey(): { key: string; index: number } {
  const keys = getStoredCovalentKeys();
  if (keys.length === 0) {
    return { key: '', index: 0 };
  }
  const idx = currentCovalentIndex % keys.length;
  currentCovalentIndex = (currentCovalentIndex + 1) % keys.length;
  return { key: keys[idx], index: idx };
}

export function getCovalentApiKey(): string {
  const keys = getStoredCovalentKeys();
  return keys.length > 0 ? keys[0] : COVALENT_DEFAULT_API_KEY;
}

export function saveCovalentApiKey(key: string): void {
  if (key && key.trim()) {
    saveStoredCovalentKeys([key.trim()]);
  }
}

export function isCovalentEnabled(): boolean {
  try {
    const val = localStorage.getItem(COVALENT_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveCovalentEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(COVALENT_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Error saving Covalent enabled flag:', err);
  }
}

export interface CovalentScanResult {
  nativeBalance: string;
  nativeValueUsd: number;
  tokens: TokenBalance[];
  totalValueUsd: number;
  hasBalance: boolean;
}

// Cache structure for Covalent API balance queries (30-second TTL)
const covalentBalanceCache: Record<string, { data: CovalentScanResult; timestamp: number }> = {};
const COVALENT_CACHE_TTL_MS = 30 * 1000;

// Concurrency throttle & rate-limit queue for Covalent API (max 3 req/sec to respect free tier)
class CovalentTaskQueue {
  private concurrency: number = 2;
  private running: number = 0;
  private queue: (() => Promise<void>)[] = [];
  private lastCallTime: number = 0;

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastCallTime;
          if (elapsed < 180) {
            await new Promise((r) => setTimeout(r, 180 - elapsed));
          }
          this.lastCallTime = Date.now();
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.runNext();
    });
  }

  private runNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    const task = this.queue.shift();
    if (task) {
      this.running++;
      task().finally(() => {
        this.running--;
        this.runNext();
      });
    }
  }
}

const covalentQueue = new CovalentTaskQueue();

/**
 * Fetch native and all ERC-20 token balances for an address on any supported EVM chain via Covalent GoldRush API
 */
export async function fetchCovalentBalancesForChain(
  chain: ChainConfig,
  address: string,
  walletLabel: string = ''
): Promise<CovalentScanResult | null> {
  const keys = getStoredCovalentKeys();
  if (keys.length === 0 || !isCovalentEnabled()) return null;

  // Covalent uses chainId number for EVM chains (e.g. 1 for ETH, 56 for BSC, 137 for Polygon, etc.)
  const chainIdentifier = chain.chainIdNum ? chain.chainIdNum.toString() : chain.id;
  const cacheKey = `${chainIdentifier}:${address.toLowerCase()}`;
  const now = Date.now();

  // Return cached result if within TTL to save credits and boost speed
  if (covalentBalanceCache[cacheKey] && now - covalentBalanceCache[cacheKey].timestamp < COVALENT_CACHE_TTL_MS) {
    logger.info('SCAN', `[${chain.shortName}] (GoldRush Cache) ${walletLabel || address.slice(0, 6)}: Menggunakan hasil cache GoldRush`);
    return covalentBalanceCache[cacheKey].data;
  }

  return covalentQueue.add(async () => {
    try {
      let activeKeyInfo = getNextCovalentApiKey();
      let apiKey = activeKeyInfo.key;
      let url = `https://api.covalenthq.com/v1/${chainIdentifier}/address/${address}/balances_v2/?no-spam=true&quote-currency=USD&key=${encodeURIComponent(apiKey)}`;

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      // Handle 429 Rate Limit with key rotation to next key in pool
      if (response.status === 429 && keys.length > 1) {
        activeKeyInfo = getNextCovalentApiKey();
        apiKey = activeKeyInfo.key;
        logger.warn('RPC', `[GoldRush #${activeKeyInfo.index + 1}] Rate limit (429). Merotasi ke Covalent key slot #${activeKeyInfo.index + 1}...`);
        url = `https://api.covalenthq.com/v1/${chainIdentifier}/address/${address}/balances_v2/?no-spam=true&quote-currency=USD&key=${encodeURIComponent(apiKey)}`;
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        });
      } else if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 600));
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        });
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logger.warn('RPC', `[GoldRush] Covalent API Key HTTP ${response.status} (Gagal Otentikasi), beralih ke direct RPC...`);
        } else if (response.status === 429) {
          logger.warn('RPC', `[GoldRush] Covalent Rate Limit (HTTP 429), beralih ke direct RPC...`);
        }
        return null;
      }

    const data = await response.json();
    if (data.error || !data.data || !Array.isArray(data.data.items)) {
      return null;
    }

    let nativeBalance = '0';
    let nativeValueUsd = 0;
    const tokens: TokenBalance[] = [];

    for (const item of data.data.items) {
      const isNative = item.native_token === true || 
        item.contract_address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      const decimals = item.contract_decimals ?? 18;
      const rawBalance = item.balance ? BigInt(item.balance) : 0n;
      if (rawBalance <= 0n) continue;

      const numBalance = Number(rawBalance) / Math.pow(10, decimals);
      const quoteRate = typeof item.quote_rate === 'number' ? item.quote_rate : 0;
      const quoteVal = typeof item.quote === 'number' ? item.quote : (numBalance * quoteRate);

      if (isNative) {
        nativeBalance = numBalance > 0.000001 ? numBalance.toFixed(6).replace(/\.?0+$/, '') : numBalance.toString();
        nativeValueUsd = quoteVal > 0 ? quoteVal : 0;
        if (numBalance > 0) {
          logger.success('SCAN', `[${chain.shortName}] (GoldRush) ${walletLabel || address.slice(0, 6)}: Ditemukan ${nativeBalance} ${chain.nativeCurrency.symbol} ($${nativeValueUsd.toFixed(2)})`);
        }
      } else {
        const symbol = item.contract_ticker_symbol || item.contract_name || 'TOKEN';
        const name = item.contract_name || symbol;
        const formattedBal = numBalance > 0.0001 ? numBalance.toFixed(4) : numBalance.toString();

        // Include token if balance is positive
        if (numBalance > 0) {
          tokens.push({
            symbol,
            name,
            balance: formattedBal,
            rawBalance: item.balance,
            decimals,
            priceUsd: quoteRate,
            valueUsd: quoteVal,
            contractAddress: item.contract_address,
            isNative: false,
          });

          logger.success('TOKEN', `[${chain.shortName}] (GoldRush) ${walletLabel || address.slice(0, 6)}: Ditemukan Token ${symbol} = ${formattedBal} ($${quoteVal.toFixed(2)})`);
        }
      }
    }

    const tokensTotalUsd = tokens.reduce((acc, t) => acc + t.valueUsd, 0);
    const totalValueUsd = nativeValueUsd + tokensTotalUsd;
    const hasBalance = parseFloat(nativeBalance) > 0 || tokens.length > 0;

    const result: CovalentScanResult = {
      nativeBalance,
      nativeValueUsd,
      tokens,
      totalValueUsd,
      hasBalance,
    };

    // Cache the result
    covalentBalanceCache[cacheKey] = { data: result, timestamp: now };

    return result;
    } catch (err: any) {
      // silently allow fallback to direct RPC
      return null;
    }
  });
}

/**
 * Fetch active chain list for an address across all EVM networks via GoldRush Covalent API
 */
export async function fetchCovalentActiveChains(address: string): Promise<string[] | null> {
  const apiKey = getCovalentApiKey();
  if (!apiKey || !isCovalentEnabled()) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const url = `https://api.covalenthq.com/v1/address/${address}/active_chains/?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.data && Array.isArray(data.data.items)) {
      return data.data.items.map((item: any) => item.name || item.chain_id?.toString()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Test Covalent GoldRush API Key connection
 */
export async function testCovalentApiKey(apiKey: string): Promise<{ success: boolean; ms?: number; message?: string }> {
  const start = performance.now();
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Key tidak boleh kosong' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    // Gunakan endpoint resmi GoldRush eth-mainnet dengan alamat Ethereum valid (Vitalik 0xd8dA...)
    const url = `https://api.covalenthq.com/v1/eth-mainnet/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/balances_v2/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const elapsed = Math.round(performance.now() - start);
    if (res.ok) {
      const json = await res.json();
      if (!json.error) {
        return { success: true, ms: elapsed, message: `GoldRush Aktif (${elapsed}ms)` };
      } else {
        return { success: false, message: json.error_message || 'Covalent Error' };
      }
    } else {
      try {
        const json = await res.json();
        if (json && json.error_message) {
          if (res.status === 401) {
            return {
              success: false,
              message: `HTTP 401: Key belum aktif (Verifikasi email atau buat key baru di goldrush.dev)`
            };
          }
          return { success: false, message: `HTTP ${res.status}: ${json.error_message}` };
        }
      } catch {
        // fallback
      }
      return { success: false, message: `HTTP ${res.status} (Key ditolak / Expired)` };
    }
  } catch (err: any) {
    return { success: false, message: err.name === 'AbortError' ? 'Timeout (>7s)' : 'Network Error / CORS' };
  }
}

/**
 * Test all configured Covalent GoldRush API Keys
 */
export async function testAllCovalentKeys(keysToTest?: string[]): Promise<
  { key: string; status: 'success' | 'error'; ms?: number; message?: string }[]
> {
  const keys = keysToTest && Array.isArray(keysToTest) ? keysToTest : getStoredCovalentKeys();
  const results = await Promise.all(
    keys.map(async (key) => {
      const res = await testCovalentApiKey(key);
      return {
        key,
        status: res.success ? ('success' as const) : ('error' as const),
        ms: res.ms,
        message: res.message,
      };
    })
  );
  return results;
}

