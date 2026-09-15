export type WalletType = 'mnemonic' | 'privateKey' | 'address';

export type ChainType = 'evm' | 'solana' | 'tron' | 'bitcoin' | 'litecoin' | 'xrp';

export type NetworkCategory = 'mainnet' | 'testnet';

export interface TokenConfig {
  symbol: string;
  name: string;
  contractAddress: string;
  decimals: number;
  logo?: string;
  coingeckoId?: string;
}

export interface ChainConfig {
  id: string; // e.g. 'eth-mainnet', 'sepolia', 'solana-mainnet'
  chainIdNum?: number; // e.g. 1, 11155111
  name: string;
  shortName: string;
  type: ChainType;
  category: NetworkCategory;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    coingeckoId: string;
    logo?: string;
  };
  rpcUrls: string[];
  explorerUrl: string;
  color: string;
  tokens: TokenConfig[];
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  rawBalance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  contractAddress?: string;
  isNative: boolean;
}

export interface NftItem {
  id: string; // Token ID or Mint address
  name: string;
  collectionName: string;
  symbol?: string;
  contractAddress: string;
  standard: 'ERC-721' | 'ERC-1155' | 'Metaplex';
  chainId: string;
  chainName: string;
  amount: number;
  imageUrl?: string;
  floorPriceNative?: number;
  floorPriceUsd: number;
  estimatedValueUsd: number;
  explorerUrl: string;
  attributes?: { trait_type: string; value: string | number }[];
}

export interface ChainAsset {
  chainId: string;
  chainName: string;
  chainShortName: string;
  chainType: ChainType;
  category: NetworkCategory;
  nativeBalance: string;
  nativePriceUsd: number;
  nativeValueUsd: number;
  tokens: TokenBalance[];
  nfts?: NftItem[];
  nftCount?: number;
  nftTotalValueUsd?: number;
  totalValueUsd: number;
  hasBalance: boolean;
  status: 'idle' | 'scanning' | 'success' | 'error';
  error?: string;
  explorerUrl: string;
}

export interface DerivedAccountInfo {
  index: number;
  path: string;
  evmAddress?: string;
  solanaAddress?: string;
  tronAddress?: string;
  btcAddress?: string;
  btcLegacyAddress?: string;
  ltcAddress?: string;
  ltcLegacyAddress?: string;
  xrpAddress?: string;
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
  tronPrivateKey?: string;
  btcPrivateKey?: string;
  ltcPrivateKey?: string;
  chainAssets: Record<string, ChainAsset>;
  totalValueUsd: number;
  hasBalance: boolean;
}

export interface ParsedWalletItem {
  id: string;
  rawInput: string;
  lineNumber: number;
  type: WalletType;
  label: string;
  tags: string[];
  maskedSecret: string;
  rawSecret: string; // Kept only in local memory
  evmAddress?: string;
  solanaAddress?: string;
  tronAddress?: string;
  btcAddress?: string;
  btcLegacyAddress?: string;
  ltcAddress?: string;
  ltcLegacyAddress?: string;
  xrpAddress?: string;
  derivedAccounts?: DerivedAccountInfo[];
  chainAssets: Record<string, ChainAsset>;
  totalNftCount?: number;
  totalNftValueUsd?: number;
  totalValueUsd: number;
  totalMainnetValueUsd: number;
  nonZeroChainsCount: number;
  hasAnyBalance: boolean;
  scanStatus: 'idle' | 'scanning' | 'done' | 'error';
  lastScannedAt?: number;
  error?: string;
  createdAt: number;
}

export interface ScanProgressState {
  isScanning: boolean;
  currentWalletIndex: number;
  totalWallets: number;
  currentChainName: string;
  currentAddress: string;
  percent: number;
  totalAssetsFoundUsd: number;
}

export interface FilterOptions {
  search: string;
  category: 'all' | 'mainnet' | 'testnet';
  selectedChainId: string; // 'all' or specific chainId
  walletType: 'all' | 'mnemonic' | 'privateKey' | 'address';
  statusFilter: 'all' | 'needs_rescan' | 'funded' | 'zero_fund' | 'scanned';
  onlyWithBalance: boolean;
  sortBy: 'value-desc' | 'value-asc' | 'chains-desc' | 'label-asc' | 'created-desc';
}

