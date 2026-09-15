import { ChainConfig } from '../types/wallet';
import { getNextHeliusRpcUrl, getAllHeliusRpcUrls } from './heliusService';
import { isDrpcEnabled, getAllDrpcUrlsForChain } from './drpcService';
import { isInfuraEnabled, getInfuraRpcUrlForChain } from './infuraService';

const CUSTOM_RPC_STORAGE_KEY = 'jmbt_custom_rpcs_v1';

export interface CustomRpcConfig {
  [chainId: string]: string; // chainId -> custom RPC URL
}

export function getStoredCustomRpcs(): CustomRpcConfig {
  try {
    const data = localStorage.getItem(CUSTOM_RPC_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('Error reading custom RPC config:', err);
    return {};
  }
}

export function saveStoredCustomRpcs(rpcs: CustomRpcConfig): void {
  try {
    localStorage.setItem(CUSTOM_RPC_STORAGE_KEY, JSON.stringify(rpcs));
  } catch (err) {
    console.error('Error saving custom RPC config:', err);
  }
}

export function getCustomRpcForChain(chainId: string): string | undefined {
  const all = getStoredCustomRpcs();
  const url = all[chainId]?.trim();
  return url ? url : undefined;
}

export function getEffectiveRpcList(chain: ChainConfig): string[] {
  const custom = getCustomRpcForChain(chain.id);
  if (custom) {
    // Custom RPC takes highest priority at index 0
    return [custom, ...chain.rpcUrls.filter((u) => u !== custom)];
  }

  if (chain.id === 'solana-mainnet') {
    const heliusUrls = getAllHeliusRpcUrls();
    const nextItem = getNextHeliusRpcUrl();
    const rotated = [
      ...heliusUrls.slice(nextItem.index),
      ...heliusUrls.slice(0, nextItem.index),
    ];
    const otherUrls = chain.rpcUrls.filter((u) => !u.includes('helius'));
    return [...rotated, ...otherUrls];
  }

  if (chain.type === 'evm') {
    const rpcList: string[] = [];

    // Infura has priority #1 for EVM if enabled
    if (isInfuraEnabled()) {
      const infuraUrl = getInfuraRpcUrlForChain(chain.id);
      if (infuraUrl) {
        rpcList.push(infuraUrl);
      }
    }

    // dRPC if enabled
    if (isDrpcEnabled()) {
      const drpcUrls = getAllDrpcUrlsForChain(chain.id);
      for (const dUrl of drpcUrls) {
        if (!rpcList.includes(dUrl)) {
          rpcList.push(dUrl);
        }
      }
    }

    // Remaining fallback RPCs
    for (const u of chain.rpcUrls) {
      if (!rpcList.includes(u)) {
        rpcList.push(u);
      }
    }

    return rpcList.length > 0 ? rpcList : chain.rpcUrls;
  }

  return chain.rpcUrls;
}

export function getEffectiveSolanaRpc(networkType: 'mainnet' | 'devnet'): string {
  const chainId = networkType === 'mainnet' ? 'solana-mainnet' : 'solana-devnet';
  const custom = getCustomRpcForChain(chainId);
  if (custom) return custom;
  
  if (networkType === 'mainnet') {
    return getNextHeliusRpcUrl().url;
  } else {
    return 'https://api.devnet.solana.com';
  }
}


