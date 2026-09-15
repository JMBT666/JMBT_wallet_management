import { ChainConfig, NftItem } from '../types/wallet';
import { logger } from './logger';

// In-memory floor price cache (10-minute TTL)
const floorPriceCache: Record<string, { floorUsd: number; floorNative: number; timestamp: number }> = {};
const CACHE_TTL_MS = 10 * 60 * 1000;

// Blockscout API base URLs for EVM chains (Free, Public, No API Key Required)
const BLOCKSCOUT_CHAIN_URLS: Record<string, string> = {
  'eth-mainnet': 'https://eth.blockscout.com',
  'base-mainnet': 'https://base.blockscout.com',
  'polygon-mainnet': 'https://polygon.blockscout.com',
  'arbitrum-mainnet': 'https://arbitrum.blockscout.com',
  'optimism-mainnet': 'https://optimism.blockscout.com',
  'bsc-mainnet': 'https://bsc.blockscout.com',
  'sepolia': 'https://eth-sepolia.blockscout.com',
};

// Known popular collection floor prices fallback estimation in USD
const KNOWN_COLLECTIONS: Record<string, number> = {
  '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d': 16800, // BAYC
  '0x60e4d786628fea6478f785a6d7e704777c86a7c6': 3100,  // MAYC
  '0xed5af388653567af2f388e6224dc7c314141963f': 8200,  // Azuki
  '0xbd3531da5cf5857e7cfaa92426877b022e612cf8': 13500, // Pudgy Penguins
  '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85': 45,    // ENS
};

/**
 * Fetch Floor Price for an EVM NFT Collection
 */
async function fetchEvmCollectionFloorPrice(
  contractAddress: string,
  nativePriceUsd: number
): Promise<{ floorNative: number; floorUsd: number }> {
  const normAddress = contractAddress.toLowerCase();
  const now = Date.now();

  if (floorPriceCache[normAddress] && now - floorPriceCache[normAddress].timestamp < CACHE_TTL_MS) {
    return {
      floorNative: floorPriceCache[normAddress].floorNative,
      floorUsd: floorPriceCache[normAddress].floorUsd,
    };
  }

  // Check known collections list
  if (KNOWN_COLLECTIONS[normAddress]) {
    const floorUsd = KNOWN_COLLECTIONS[normAddress];
    const floorNative = nativePriceUsd > 0 ? floorUsd / nativePriceUsd : 0;
    floorPriceCache[normAddress] = { floorNative, floorUsd, timestamp: now };
    return { floorNative, floorUsd };
  }

  return { floorNative: 0, floorUsd: 0 };
}

/**
 * Fetch EVM NFTs (ERC-721 and ERC-1155) for an address using Blockscout API
 */
export async function fetchEvmNfts(
  chain: ChainConfig,
  address: string,
  nativePriceUsd: number
): Promise<NftItem[]> {
  const baseUrl = BLOCKSCOUT_CHAIN_URLS[chain.id];
  if (!baseUrl) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `${baseUrl}/api/v2/addresses/${address}/nft?type=ERC-721%2CERC-1155`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    if (!data || !Array.isArray(data.items)) return [];

    const nfts: NftItem[] = [];

    for (const item of data.items) {
      const contract = item.token?.address_hash || '';
      const collectionName = item.token?.name || item.metadata?.name || 'NFT Collection';
      const tokenName = item.metadata?.name || `${collectionName} #${item.id?.slice(0, 6) || '0'}`;
      const standard: 'ERC-721' | 'ERC-1155' = item.token_type === 'ERC-1155' ? 'ERC-1155' : 'ERC-721';
      const amount = parseInt(item.value || '1', 10) || 1;

      // Image preview extraction
      let imageUrl = item.image_url || item.metadata?.image || item.metadata?.image_url;
      if (imageUrl && imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      // Calculate floor price and valuation
      const { floorNative, floorUsd } = await fetchEvmCollectionFloorPrice(contract, nativePriceUsd);
      const estimatedValueUsd = floorUsd > 0 ? floorUsd * amount : 0;

      nfts.push({
        id: item.id || `${contract}_${nfts.length}`,
        name: tokenName,
        collectionName,
        symbol: item.token?.symbol,
        contractAddress: contract,
        standard,
        chainId: chain.id,
        chainName: chain.name,
        amount,
        imageUrl,
        floorPriceNative: floorNative,
        floorPriceUsd: floorUsd,
        estimatedValueUsd,
        explorerUrl: `${chain.explorerUrl}/token/${contract}/instance/${item.id || ''}`,
        attributes: Array.isArray(item.metadata?.attributes) ? item.metadata.attributes : undefined,
      });
    }

    if (nfts.length > 0) {
      const totalVal = nfts.reduce((acc, n) => acc + n.estimatedValueUsd, 0);
      logger.success(
        'SCAN',
        `[${chain.shortName}] Ditemukan ${nfts.length} NFT Koleksi (${totalVal > 0 ? '$' + totalVal.toFixed(2) : 'Aset Kolektibel'})`
      );
    }

    return nfts;
  } catch {
    return [];
  }
}

/**
 * Fetch Solana NFTs (Metaplex standard) for a Solana address
 */
export async function fetchSolanaNfts(
  address: string,
  solPriceUsd: number,
  rawTokenAccounts: any[] = []
): Promise<NftItem[]> {
  const nfts: NftItem[] = [];

  // Filter token accounts with decimals === 0 and amount === 1 (Standard Metaplex NFT token account)
  const nftAccounts = rawTokenAccounts.filter(({ account }) => {
    const info = account?.data?.parsed?.info;
    return info && info.tokenAmount && info.tokenAmount.decimals === 0 && info.tokenAmount.amount === '1';
  });

  if (nftAccounts.length === 0) return [];

  // Solana rent exemption deposit per NFT account is ~0.00203928 SOL
  const SOL_RENT_EXEMPT_SOL = 0.00203928;
  const rentValueUsd = SOL_RENT_EXEMPT_SOL * (solPriceUsd > 0 ? solPriceUsd : 150);

  for (const { account } of nftAccounts.slice(0, 30)) { // Limit to 30 to keep scan ultra-fast
    const info = account.data.parsed.info;
    const mint = info.mint;

    let collectionName = 'Solana NFT';
    let nftName = `NFT #${mint.slice(0, 4)}...${mint.slice(-4)}`;
    let imageUrl: string | undefined;
    let floorPriceSol = SOL_RENT_EXEMPT_SOL; // Guaranteed rent value
    let floorPriceUsd = rentValueUsd;

    // Check Magic Eden API for live floor price & metadata
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const meRes = await fetch(`https://api-mainnet.magiceden.dev/v2/tokens/${mint}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData) {
          if (meData.name) nftName = meData.name;
          if (meData.collectionTitle || meData.collection) collectionName = meData.collectionTitle || meData.collection;
          if (meData.image) imageUrl = meData.image;

          // If collection has stats, fetch collection floor price
          if (meData.collection) {
            const statsRes = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${meData.collection}/stats`);
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              if (statsData && statsData.floorPrice) {
                const meFloorSol = statsData.floorPrice / 1_000_000_000;
                if (meFloorSol > 0) {
                  floorPriceSol = meFloorSol;
                  floorPriceUsd = meFloorSol * solPriceUsd;
                }
              }
            }
          }
        }
      }
    } catch {
      // fallback to rent deposit value
    }

    nfts.push({
      id: mint,
      name: nftName,
      collectionName,
      contractAddress: mint,
      standard: 'Metaplex',
      chainId: 'solana-mainnet',
      chainName: 'Solana',
      amount: 1,
      imageUrl,
      floorPriceNative: floorPriceSol,
      floorPriceUsd,
      estimatedValueUsd: floorPriceUsd,
      explorerUrl: `https://solscan.io/token/${mint}`,
    });
  }

  if (nfts.length > 0) {
    const totalVal = nfts.reduce((acc, n) => acc + n.estimatedValueUsd, 0);
    logger.success(
      'SCAN',
      `[Solana] Ditemukan ${nfts.length} Solana NFT (${totalVal > 0 ? '$' + totalVal.toFixed(2) : 'Aset Kolektibel'})`
    );
  }

  return nfts;
}

