import { logger } from './logger';

export const DEFAULT_INFURA_KEY = '2d6d988c7e014bc2b7c4d494248c1daf';

const INFURA_KEY_STORAGE_KEY = 'jmbt_infura_key_v1';
const INFURA_ENABLED_KEY = 'jmbt_infura_enabled_v1';

export function isInfuraEnabled(): boolean {
  try {
    const val = localStorage.getItem(INFURA_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveInfuraEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(INFURA_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Error saving Infura enabled state:', err);
  }
}

export function getStoredInfuraKey(): string {
  try {
    const k = localStorage.getItem(INFURA_KEY_STORAGE_KEY);
    if (k && k.trim()) return k.trim();
  } catch (err) {
    console.error('Error reading Infura key:', err);
  }
  return DEFAULT_INFURA_KEY;
}

export function saveStoredInfuraKey(key: string): void {
  try {
    localStorage.setItem(INFURA_KEY_STORAGE_KEY, key.trim());
  } catch (err) {
    console.error('Error saving Infura key:', err);
  }
}

// Map chain IDs to Infura subdomains
const INFURA_CHAIN_MAP: Record<string, string> = {
  ethereum: 'mainnet',
  sepolia: 'sepolia',
  holesky: 'holesky',
  bsc: 'bsc-mainnet',
  'bsc-testnet': 'bsc-testnet',
  polygon: 'polygon-mainnet',
  'polygon-amoy': 'polygon-amoy',
  arbitrum: 'arbitrum-mainnet',
  'arbitrum-sepolia': 'arbitrum-sepolia',
  optimism: 'optimism-mainnet',
  'op-sepolia': 'optimism-sepolia',
  base: 'base-mainnet',
  'base-sepolia': 'base-sepolia',
  linea: 'linea-mainnet',
  'linea-sepolia': 'linea-sepolia',
  avalanche: 'avalanche-mainnet',
  'avalanche-fuji': 'avalanche-fuji',
};

/**
 * Returns the high-speed Infura RPC endpoint for the specified EVM chain.
 */
export function getInfuraRpcUrlForChain(chainId: string, key?: string): string | null {
  const subdomain = INFURA_CHAIN_MAP[chainId];
  if (!subdomain) return null;
  const targetKey = key || getStoredInfuraKey();
  if (!targetKey) return null;
  return `https://${subdomain}.infura.io/v3/${targetKey}`;
}

/**
 * Tests latency and validity of the configured Infura key on Ethereum Mainnet & BSC.
 */
export async function testInfuraKey(keyToTest?: string): Promise<{
  ethereum: { status: 'success' | 'error'; ms?: number; message?: string };
  bsc: { status: 'success' | 'error'; ms?: number; message?: string };
}> {
  const key = keyToTest || getStoredInfuraKey();
  const testChain = async (subdomain: string) => {
    const start = performance.now();
    try {
      const res = await fetch(`https://${subdomain}.infura.io/v3/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      });
      const ms = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          return { status: 'success' as const, ms, message: `Block: ${parseInt(data.result, 16)}` };
        }
        return { status: 'error' as const, ms, message: data.error?.message || 'Invalid RPC response' };
      }
      return { status: 'error' as const, ms, message: `HTTP ${res.status}` };
    } catch (err: any) {
      return { status: 'error' as const, message: err.message || 'Connection failed' };
    }
  };

  const [ethRes, bscRes] = await Promise.all([
    testChain('mainnet'),
    testChain('bsc-mainnet'),
  ]);

  return { ethereum: ethRes, bsc: bscRes };
}

