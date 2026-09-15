import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SUPPORTED_CHAINS, ERC20_ABI } from '../config/chains';
import { ChainAsset, ChainConfig, ParsedWalletItem, TokenBalance } from '../types/wallet';
import { fetchLiveCryptoPrices, getPriceForToken } from './priceFeed';
import { logger } from './logger';
import { getEffectiveRpcList } from './rpcConfig';
import { fetchCovalentBalancesForChain } from './covalentService';
import { fetchEvmNfts, fetchSolanaNfts } from './nftService';
import bs58 from 'bs58';

// Concurrency throttle queue
class TaskQueue {
  private concurrency: number;
  private running: number = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor(concurrency: number = 6) {
    this.concurrency = concurrency;
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
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

const evmQueue = new TaskQueue(6);
const solanaQueue = new TaskQueue(4);
const tronQueue = new TaskQueue(4);
const btcQueue = new TaskQueue(4);
const ltcQueue = new TaskQueue(4);
const xrpQueue = new TaskQueue(5);

// In-memory cache for dynamic DexScreener token metadata
const dynamicTokenCache: Record<string, { symbol: string; name: string; priceUsd: number }> = {};

async function fetchDexScreenerTokenInfo(mint: string): Promise<{ symbol: string; name: string; priceUsd: number } | null> {
  if (dynamicTokenCache[mint]) {
    return dynamicTokenCache[mint];
  }
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.pairs && data.pairs.length > 0) {
        const topPair = data.pairs[0];
        const baseToken = topPair.baseToken;
        const priceUsd = parseFloat(topPair.priceUsd || '0');
        const info = {
          symbol: baseToken.symbol || mint.slice(0, 4) + '...' + mint.slice(-4),
          name: baseToken.name || 'SPL Token',
          priceUsd,
        };
        dynamicTokenCache[mint] = info;
        return info;
      }
    }
  } catch {
    // ignore fetch error
  }
  return null;
}

// Helper to query with timeout
async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('RPC Timeout')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

/**
 * Direct JSON-RPC eth_getBalance query to bypass ethers.js overhead or serialization issues
 */
async function queryEvmBalanceDirect(rpcUrl: string, address: string, timeoutMs = 5000): Promise<bigint | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (json && typeof json.result === 'string' && json.result.startsWith('0x')) {
      return BigInt(json.result);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fallback to official Blockscout Explorer REST API (verified on-chain wei balance)
 */
async function fetchBlockscoutNativeBalance(chainId: string, address: string, timeoutMs = 6000): Promise<bigint | null> {
  const map: Record<string, string> = {
    ethereum: 'https://eth.blockscout.com',
    base: 'https://base.blockscout.com',
    polygon: 'https://polygon.blockscout.com',
    arbitrum: 'https://arbitrum.blockscout.com',
    optimism: 'https://optimism.blockscout.com',
    sepolia: 'https://eth-sepolia.blockscout.com',
  };
  const base = map[chainId];
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${base}/api/v2/addresses/${address}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.coin_balance === 'string' && data.coin_balance !== '') {
      return BigInt(data.coin_balance);
    }
  } catch {
    // ignore
  }
  return null;
}

// Fetch EVM Balance & Tokens with multi-RPC fallback
export async function scanEvmChain(
  address: string,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'evm',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `${chain.explorerUrl}/address/${address}`,
  };

  // 1. Try Ultra-Fast Multi-Token Indexing via Covalent GoldRush API
  try {
    const covalentData = await fetchCovalentBalancesForChain(chain, address, walletLabel);
    if (covalentData) {
      result.nativeBalance = covalentData.nativeBalance;
      result.nativeValueUsd = covalentData.nativeValueUsd;
      result.tokens = covalentData.tokens;
      result.totalValueUsd = covalentData.totalValueUsd;
      result.hasBalance = covalentData.hasBalance;
      result.status = 'success';
      return result;
    }
  } catch {
    // fallback to direct RPC
  }

  let provider: ethers.JsonRpcProvider | null = null;
  let rawBal: bigint | null = null;
  let lastError: any = null;

  // Try available RPCs (custom user RPC takes 1st priority)
  const availableRpcs = getEffectiveRpcList(chain);
  for (const rpcUrl of availableRpcs) {
    try {
      const p = new ethers.JsonRpcProvider(rpcUrl, chain.chainIdNum, { staticNetwork: true });
      rawBal = await fetchWithTimeout(p.getBalance(address), 6000);
      provider = p;
      break;
    } catch (err: any) {
      lastError = err;
      // Secondary attempt: Direct JSON-RPC fetch to bypass any ethers serialization issues
      try {
        const directBal = await queryEvmBalanceDirect(rpcUrl, address, 4000);
        if (directBal !== null) {
          rawBal = directBal;
          provider = new ethers.JsonRpcProvider(rpcUrl, chain.chainIdNum, { staticNetwork: true });
          break;
        }
      } catch {
        // ignore
      }
      logger.warn('RPC', `[${chain.shortName}] Gagal menghubungi ${rpcUrl}: ${err.message}. Mencoba RPC cadangan...`);
    }
  }

  // Fallback: If all RPCs failed, attempt Blockscout Explorer API fallback
  if (rawBal === null) {
    try {
      const bsBal = await fetchBlockscoutNativeBalance(chain.id, address);
      if (bsBal !== null) {
        rawBal = bsBal;
        logger.info('SCAN', `[${chain.shortName}] Berhasil sinkronisasi saldo resmi via Explorer API`);
      }
    } catch {
      // ignore
    }
  }

  if (rawBal !== null) {
    const formatted = ethers.formatEther(rawBal);
    const parsedNum = parseFloat(formatted);

    result.nativeBalance = parsedNum > 0 ? (parsedNum > 0.000001 ? parsedNum.toFixed(6).replace(/\.?0+$/, '') : parsedNum.toString()) : '0';
    result.nativeValueUsd = chain.category === 'mainnet' ? parsedNum * result.nativePriceUsd : 0;
    if (parsedNum > 0) {
      result.hasBalance = true;
      logger.success('SCAN', `[${chain.shortName}] ${walletLabel || address.slice(0, 6)}: Ditemukan ${result.nativeBalance} ${chain.nativeCurrency.symbol} ($${result.nativeValueUsd.toFixed(2)})`);
    }
  } else {
    // Both RPCs and explorer API failed
    result.status = 'error';
    result.error = lastError?.message || 'Failed to connect to RPC';
    logger.error('RPC', `[${chain.shortName}] Semua RPC gagal untuk alamat ${address.slice(0, 6)}...`);
    return result;
  }

  // Scan Tokens for Mainnets
  if (chain.tokens.length > 0) {
    const tokenPromises = chain.tokens.map(async (tok) => {
      try {
        const contract = new ethers.Contract(tok.contractAddress, ERC20_ABI, provider!);
        const rawTokenBal = await fetchWithTimeout(contract.balanceOf(address), 5000);
        if (rawTokenBal && rawTokenBal > 0n) {
          const formattedTok = ethers.formatUnits(rawTokenBal, tok.decimals);
          const tokNum = parseFloat(formattedTok);
          if (tokNum > 0) {
            const price = chain.category === 'mainnet' ? getPriceForToken(tok.coingeckoId) : 0;
            const valUsd = tokNum * price;
            const tokenBalance: TokenBalance = {
              symbol: tok.symbol,
              name: tok.name,
              balance: tokNum > 0.0001 ? tokNum.toFixed(4) : tokNum.toString(),
              rawBalance: rawTokenBal.toString(),
              decimals: tok.decimals,
              priceUsd: price,
              valueUsd: valUsd,
              contractAddress: tok.contractAddress,
              isNative: false,
            };
            logger.success('TOKEN', `[${chain.shortName}] ${walletLabel || address.slice(0, 6)}: Ditemukan Token ${tok.symbol} = ${tokenBalance.balance} ($${valUsd.toFixed(2)})`);
            return tokenBalance;
          }
        }
      } catch {
        // token query failed
      }
      return null;
    });

    const tokenResults = await Promise.all(tokenPromises);
    const validTokens = tokenResults.filter((t): t is TokenBalance => t !== null);
    result.tokens = validTokens;
    if (validTokens.length > 0) {
      result.hasBalance = true;
    }
  }

  // 3. Scan NFTs (ERC-721 / ERC-1155) via Blockscout API
  try {
    const nfts = await fetchEvmNfts(chain, address, result.nativePriceUsd);
    if (nfts.length > 0) {
      result.nfts = nfts;
      result.nftCount = nfts.length;
      result.nftTotalValueUsd = nfts.reduce((acc, n) => acc + n.estimatedValueUsd, 0);
      result.hasBalance = true;
    }
  } catch {
    // silently allow NFT scan failure
  }

  const tokensTotalUsd = result.tokens.reduce((acc, t) => acc + t.valueUsd, 0);
  const nftTotalUsd = result.nftTotalValueUsd || 0;
  result.totalValueUsd = result.nativeValueUsd + tokensTotalUsd + nftTotalUsd;
  result.status = 'success';
  return result;
}

// Fetch Solana Balance & Dynamic SPL Tokens (Standard + Token-2022)
export async function scanSolanaChain(
  address: string,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'solana',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `${chain.explorerUrl}/account/${address}${chain.category === 'testnet' ? '?cluster=devnet' : ''}`,
  };

  try {
    const pubkey = new PublicKey(address);
    let connection: Connection | null = null;

    const availableRpcs = getEffectiveRpcList(chain);
    for (const rpcUrl of availableRpcs) {
      try {
        const conn = new Connection(rpcUrl, 'confirmed');
        const lamports = await fetchWithTimeout(conn.getBalance(pubkey), 6000);
        const solBal = lamports / LAMPORTS_PER_SOL;
        result.nativeBalance = solBal > 0 ? (solBal > 0.00001 ? solBal.toFixed(6).replace(/\.?0+$/, '') : solBal.toString()) : '0';
        result.nativeValueUsd = chain.category === 'mainnet' ? solBal * result.nativePriceUsd : 0;
        if (solBal > 0) {
          result.hasBalance = true;
          logger.success('SCAN', `[${chain.shortName}] ${walletLabel || address.slice(0, 6)}: Ditemukan ${result.nativeBalance} SOL ($${result.nativeValueUsd.toFixed(2)})`);
        }
        connection = conn;
        break;
      } catch (err: any) {
        logger.warn('RPC', `[Solana] Gagal menghubungi ${rpcUrl}: ${err.message}. Mencoba RPC cadangan...`);
      }
    }

    if (!connection) {
      result.status = 'error';
      result.error = 'Solana RPC unreachable';
      logger.error('RPC', `[Solana] Semua node Solana gagal merespons.`);
      return result;
    }

    // Dynamic SPL Token Scan (Standard SPL + Token-2022)
    const tokenAccountsRaw: any[] = [];

    // 1. Standard Token Program
    try {
      const stdAccounts = await fetchWithTimeout(
        connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: TOKEN_PROGRAM_ID,
        }),
        7000
      );
      tokenAccountsRaw.push(...stdAccounts.value);
    } catch {
      // ignore
    }

    // 2. Token-2022 Program
    try {
      const t22Accounts = await fetchWithTimeout(
        connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        7000
      );
      tokenAccountsRaw.push(...t22Accounts.value);
    } catch {
      // ignore
    }

    // Parse detected token accounts with amount > 0
    const discoveredTokens: TokenBalance[] = [];

    for (const { account } of tokenAccountsRaw) {
      const info = account.data.parsed?.info;
      if (info && info.tokenAmount) {
        const amount = parseFloat(info.tokenAmount.uiAmountString || '0');
        if (amount > 0) {
          const mint = info.mint;
          const matchedConfig = chain.tokens.find((t) => t.contractAddress === mint);

          let symbol = matchedConfig?.symbol;
          let name = matchedConfig?.name;
          let price = matchedConfig ? getPriceForToken(matchedConfig.coingeckoId) : 0;

          // If not in static list and on mainnet, fetch live metadata & price from DexScreener
          if (!symbol && chain.category === 'mainnet') {
            const dynamicInfo = await fetchDexScreenerTokenInfo(mint);
            if (dynamicInfo) {
              symbol = dynamicInfo.symbol;
              name = dynamicInfo.name;
              price = dynamicInfo.priceUsd;
            } else {
              symbol = mint.slice(0, 4) + '...' + mint.slice(-4);
              name = 'SPL Token';
            }
          } else if (!symbol) {
            symbol = mint.slice(0, 4) + '...' + mint.slice(-4);
            name = 'Testnet Token';
          }

          const valUsd = amount * price;

          discoveredTokens.push({
            symbol: symbol || 'SPL',
            name: name || 'SPL Token',
            balance: amount > 0.0001 ? amount.toFixed(4) : amount.toString(),
            rawBalance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            priceUsd: price,
            valueUsd: valUsd,
            contractAddress: mint,
            isNative: false,
          });

          logger.success('TOKEN', `[Solana] ${walletLabel || address.slice(0, 6)}: Ditemukan SPL Token ${symbol} = ${amount.toFixed(4)} ($${valUsd.toFixed(2)})`);
        }
      }
    }

    result.tokens = discoveredTokens;
    if (discoveredTokens.length > 0) {
      result.hasBalance = true;
    }

    // Scan Solana Metaplex NFTs & Floor Values
    try {
      const solNfts = await fetchSolanaNfts(address, result.nativePriceUsd, tokenAccountsRaw);
      if (solNfts.length > 0) {
        result.nfts = solNfts;
        result.nftCount = solNfts.length;
        result.nftTotalValueUsd = solNfts.reduce((acc, n) => acc + n.estimatedValueUsd, 0);
        result.hasBalance = true;
      }
    } catch {
      // ignore
    }

    const tokensTotalUsd = result.tokens.reduce((acc, t) => acc + t.valueUsd, 0);
    const nftTotalUsd = result.nftTotalValueUsd || 0;
    result.totalValueUsd = result.nativeValueUsd + tokensTotalUsd + nftTotalUsd;
    result.status = 'success';
  } catch (err: any) {
    result.status = 'error';
    result.error = err?.message || 'Error scanning Solana';
    logger.error('SCAN', `[Solana] Error scan ${address.slice(0, 6)}: ${err.message}`);
  }

  return result;
}

// Fetch TRON Balance & TRC-20 Tokens (USDT, etc.) via TronGrid API
export async function scanTronChain(
  address: string,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'tron',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `${chain.explorerUrl}/#/address/${address}`,
  };

  try {
    let accData: any = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.length > 0) {
          accData = json.data[0];
        }
      }
    } catch {
      // ignore, fallback to publicnode
    }

    if (!accData) {
      try {
        const bs58Dec = typeof bs58.decode === 'function' ? bs58.decode : ((bs58 as any).default && (bs58 as any).default.decode);
        const hex = Buffer.from(bs58Dec(address).slice(0, 21)).toString('hex');
        const fbRes = await fetch('https://tron-rpc.publicnode.com/wallet/getaccount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: hex }),
        });
        if (fbRes.ok) {
          const fbJson = await fbRes.json();
          if (fbJson && typeof fbJson.balance === 'number') {
            accData = { balance: fbJson.balance, trc20: [] };
          }
        }
      } catch {
        // ignore
      }
    }

    if (accData) {
      // TRX balance in SUN (1 TRX = 1e6 SUN)
      const sunBal = accData.balance || 0;
      const trxBal = sunBal / 1000000;

        result.nativeBalance = trxBal > 0 ? (trxBal > 0.00001 ? trxBal.toFixed(6).replace(/\.?0+$/, '') : trxBal.toString()) : '0';
        result.nativeValueUsd = chain.category === 'mainnet' ? trxBal * result.nativePriceUsd : 0;
        if (trxBal > 0) {
          result.hasBalance = true;
          logger.success('SCAN', `[TRON] ${walletLabel || address.slice(0, 6)}: Ditemukan ${result.nativeBalance} TRX ($${result.nativeValueUsd.toFixed(2)})`);
        }

        // TRC20 Token Balances
        if (accData.trc20 && Array.isArray(accData.trc20)) {
          const discoveredTokens: TokenBalance[] = [];
          for (const trc20Obj of accData.trc20) {
            for (const [contractAddr, rawAmtStr] of Object.entries(trc20Obj)) {
              const matchedTok = chain.tokens.find((t) => t.contractAddress === contractAddr);
              if (matchedTok && typeof rawAmtStr === 'string') {
                try {
                  const rawAmt = BigInt(rawAmtStr);
                  if (rawAmt > 0n) {
                    const formatted = ethers.formatUnits(rawAmt, matchedTok.decimals);
                    const tokNum = parseFloat(formatted);
                    if (tokNum > 0) {
                      const price = chain.category === 'mainnet' ? getPriceForToken(matchedTok.coingeckoId) : 0;
                      const valUsd = tokNum * price;
                      const tokenBal: TokenBalance = {
                        symbol: matchedTok.symbol,
                        name: matchedTok.name,
                        balance: tokNum > 0.0001 ? tokNum.toFixed(4) : tokNum.toString(),
                        rawBalance: rawAmtStr,
                        decimals: matchedTok.decimals,
                        priceUsd: price,
                        valueUsd: valUsd,
                        contractAddress: contractAddr,
                        isNative: false,
                      };
                      discoveredTokens.push(tokenBal);
                      logger.success('TOKEN', `[TRON] ${walletLabel || address.slice(0, 6)}: Ditemukan TRC20 ${matchedTok.symbol} = ${tokenBal.balance} ($${valUsd.toFixed(2)})`);
                    }
                  }
                } catch {
                  // ignore parse error
                }
              }
            }
          }
          result.tokens = discoveredTokens;
          if (discoveredTokens.length > 0) {
            result.hasBalance = true;
          }
        }
        const tokensTotalUsd = result.tokens.reduce((acc, t) => acc + t.valueUsd, 0);
        result.totalValueUsd = result.nativeValueUsd + tokensTotalUsd;
        result.status = 'success';
      } else {
        result.status = 'error';
        result.error = 'Gagal mengambil data akun TRON dari TronGrid maupun Fullnode RPC';
      }
    } catch (err: any) {
    result.status = 'error';
    result.error = err?.message || 'Error scanning TRON';
    logger.error('SCAN', `[TRON] Error scan ${address.slice(0, 6)}: ${err.message}`);
  }

  return result;
}

// Fetch Bitcoin Balance (Native SegWit & Legacy) via Mempool.space / Blockstream API
export async function scanBitcoinChain(
  btcAddress: string | undefined,
  btcLegacyAddress: string | undefined,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const primaryAddress = btcAddress || btcLegacyAddress || '';
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'bitcoin',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `https://mempool.space/address/${primaryAddress}`,
  };

  const addressesToScan = Array.from(new Set([btcAddress, btcLegacyAddress].filter((a): a is string => Boolean(a && a.length > 0))));
  if (addressesToScan.length === 0) {
    result.status = 'success';
    return result;
  }

  try {
    let totalSatoshis = 0;
    for (const addr of addressesToScan) {
      let fetched = false;
      const apiEndpoints = [
        `https://mempool.space/api/address/${addr}`,
        `https://blockstream.info/api/address/${addr}`,
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 7000);
          const res = await fetch(endpoint, { signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const funded = data?.chain_stats?.funded_txo_sum || 0;
            const spent = data?.chain_stats?.spent_txo_sum || 0;
            const bal = Math.max(0, funded - spent);
            totalSatoshis += bal;
            fetched = true;
            break;
          }
        } catch {
          // try fallback endpoint
        }
      }

      if (!fetched) {
        // If an endpoint failed, log warning but continue
      }
    }

    const btcBal = totalSatoshis / 100000000;
    result.nativeBalance = btcBal > 0 ? (btcBal > 0.00001 ? btcBal.toFixed(8).replace(/\.?0+$/, '') : btcBal.toString()) : '0';
    result.nativeValueUsd = chain.category === 'mainnet' ? btcBal * result.nativePriceUsd : 0;
    result.totalValueUsd = result.nativeValueUsd;
    result.hasBalance = btcBal > 0;
    result.status = 'success';

    if (btcBal > 0) {
      logger.success('SCAN', `[BTC] ${walletLabel || primaryAddress.slice(0, 6)}: Ditemukan ${result.nativeBalance} BTC ($${result.nativeValueUsd.toFixed(2)})`);
    }
  } catch (err: any) {
    result.status = 'error';
    result.error = err?.message || 'Error scanning Bitcoin';
    logger.error('SCAN', `[BTC] Error scan ${primaryAddress.slice(0, 6)}: ${err.message}`);
  }

  return result;
}

// Fetch Litecoin Balance (Native SegWit & Legacy) via LitecoinSpace API
export async function scanLitecoinChain(
  ltcAddress: string | undefined,
  ltcLegacyAddress: string | undefined,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const primaryAddress = ltcAddress || ltcLegacyAddress || '';
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'litecoin',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `https://litecoinspace.org/address/${primaryAddress}`,
  };

  const addressesToScan = Array.from(new Set([ltcAddress, ltcLegacyAddress].filter((a): a is string => Boolean(a && a.length > 0))));
  if (addressesToScan.length === 0) {
    result.status = 'success';
    return result;
  }

  try {
    let totalLitoshis = 0;
    for (const addr of addressesToScan) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(`https://litecoinspace.org/api/address/${addr}`, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const funded = data?.chain_stats?.funded_txo_sum || 0;
          const spent = data?.chain_stats?.spent_txo_sum || 0;
          const bal = Math.max(0, funded - spent);
          totalLitoshis += bal;
        }
      } catch {
        // continue
      }
    }

    const ltcBal = totalLitoshis / 100000000;
    result.nativeBalance = ltcBal > 0 ? (ltcBal > 0.00001 ? ltcBal.toFixed(8).replace(/\.?0+$/, '') : ltcBal.toString()) : '0';
    result.nativeValueUsd = chain.category === 'mainnet' ? ltcBal * result.nativePriceUsd : 0;
    result.totalValueUsd = result.nativeValueUsd;
    result.hasBalance = ltcBal > 0;
    result.status = 'success';

    if (ltcBal > 0) {
      logger.success('SCAN', `[LTC] ${walletLabel || primaryAddress.slice(0, 6)}: Ditemukan ${result.nativeBalance} LTC ($${result.nativeValueUsd.toFixed(2)})`);
    }
  } catch (err: any) {
    result.status = 'error';
    result.error = err?.message || 'Error scanning Litecoin';
    logger.error('SCAN', `[LTC] Error scan ${primaryAddress.slice(0, 6)}: ${err.message}`);
  }

  return result;
}

// Fetch Ripple XRP Balance via XRPL JSON-RPC
export async function scanXrpChain(
  address: string,
  chain: ChainConfig,
  prices: Record<string, number>,
  walletLabel: string = ''
): Promise<ChainAsset> {
  const result: ChainAsset = {
    chainId: chain.id,
    chainName: chain.name,
    chainShortName: chain.shortName,
    chainType: 'xrp',
    category: chain.category,
    nativeBalance: '0',
    nativePriceUsd: chain.category === 'mainnet' ? (prices[chain.nativeCurrency.coingeckoId] || 0) : 0,
    nativeValueUsd: 0,
    tokens: [],
    totalValueUsd: 0,
    hasBalance: false,
    status: 'scanning',
    explorerUrl: `https://xrpscan.com/account/${address}`,
  };

  const rpcEndpoints = ['https://xrplcluster.com', 'https://s1.ripple.com:51234'];

  for (const endpoint of rpcEndpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_info',
          params: [{ account: address, ledger_index: 'validated' }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data?.result?.error === 'actNotFound') {
          // Account unactivated on XRPL (0 balance)
          result.nativeBalance = '0';
          result.nativeValueUsd = 0;
          result.totalValueUsd = 0;
          result.hasBalance = false;
          result.status = 'success';
          return result;
        }

        if (data?.result?.account_data?.Balance) {
          const drops = parseInt(data.result.account_data.Balance, 10) || 0;
          const xrpBal = drops / 1000000;
          result.nativeBalance = xrpBal > 0 ? (xrpBal > 0.0001 ? xrpBal.toFixed(6).replace(/\.?0+$/, '') : xrpBal.toString()) : '0';
          result.nativeValueUsd = chain.category === 'mainnet' ? xrpBal * result.nativePriceUsd : 0;
          result.totalValueUsd = result.nativeValueUsd;
          result.hasBalance = xrpBal > 0;
          result.status = 'success';

          if (xrpBal > 0) {
            logger.success('SCAN', `[XRP] ${walletLabel || address.slice(0, 6)}: Ditemukan ${result.nativeBalance} XRP ($${result.nativeValueUsd.toFixed(2)})`);
          }
          return result;
        }
      }
    } catch {
      // try fallback RPC
    }
  }

  // If all RPC endpoints failed
  result.status = 'error';
  result.error = 'XRPL cluster unavailable';
  return result;
}

// Scanner Manager for single wallet
export interface ScannerCallbacks {
  onWalletStart?: (walletId: string) => void;
  onChainUpdate?: (walletId: string, chainId: string, asset: ChainAsset) => void;
  onWalletComplete?: (wallet: ParsedWalletItem) => void;
  onProgress?: (progress: {
    scannedWallets: number;
    totalWallets: number;
    currentWalletLabel: string;
    currentChain: string;
    percent: number;
  }) => void;
}

export async function scanSingleWallet(
  wallet: ParsedWalletItem,
  selectedChains: ChainConfig[] = SUPPORTED_CHAINS,
  prices: Record<string, number>,
  callbacks?: ScannerCallbacks
): Promise<ParsedWalletItem> {
  const updatedWallet: ParsedWalletItem = {
    ...wallet,
    chainAssets: { ...wallet.chainAssets },
    scanStatus: 'scanning',
  };

  logger.info('SCAN', `Memulai pemindaian wallet "${wallet.label}" (${wallet.type}) di ${selectedChains.length} jaringan...`);
  callbacks?.onWalletStart?.(wallet.id);

  const chainPromises = selectedChains.map((chain) => {
    return (async () => {
      let chainAsset: ChainAsset;
      if (chain.type === 'evm' && wallet.evmAddress) {
        chainAsset = await evmQueue.add(() => scanEvmChain(wallet.evmAddress!, chain, prices, wallet.label));
      } else if (chain.type === 'solana' && wallet.solanaAddress) {
        chainAsset = await solanaQueue.add(() => scanSolanaChain(wallet.solanaAddress!, chain, prices, wallet.label));
      } else if (chain.type === 'tron' && wallet.tronAddress) {
        chainAsset = await tronQueue.add(() => scanTronChain(wallet.tronAddress!, chain, prices, wallet.label));
      } else if (chain.type === 'bitcoin' && (wallet.btcAddress || wallet.btcLegacyAddress)) {
        chainAsset = await btcQueue.add(() => scanBitcoinChain(wallet.btcAddress, wallet.btcLegacyAddress, chain, prices, wallet.label));
      } else if (chain.type === 'litecoin' && (wallet.ltcAddress || wallet.ltcLegacyAddress)) {
        chainAsset = await ltcQueue.add(() => scanLitecoinChain(wallet.ltcAddress, wallet.ltcLegacyAddress, chain, prices, wallet.label));
      } else if (chain.type === 'xrp' && wallet.xrpAddress) {
        chainAsset = await xrpQueue.add(() => scanXrpChain(wallet.xrpAddress!, chain, prices, wallet.label));
      } else {
        return;
      }

      updatedWallet.chainAssets[chain.id] = chainAsset;
      callbacks?.onChainUpdate?.(wallet.id, chain.id, chainAsset);
    })();
  });

  await Promise.all(chainPromises);

  // Recalculate totals including NFTs
  let totalMainnetVal = 0;
  let nonZeroCount = 0;
  let totalNftCount = 0;
  let totalNftValueUsd = 0;
  const errorChains: string[] = [];

  for (const asset of Object.values(updatedWallet.chainAssets)) {
    if (asset.status === 'error' && asset.category === 'mainnet') {
      errorChains.push(asset.chainShortName);
    }
    if (asset.hasBalance) {
      nonZeroCount++;
      if (asset.category === 'mainnet') {
        totalMainnetVal += asset.totalValueUsd;
      }
    }
    if (asset.nfts && asset.nfts.length > 0) {
      totalNftCount += asset.nfts.length;
      totalNftValueUsd += (asset.nftTotalValueUsd || 0);
    }
  }

  updatedWallet.totalNftCount = totalNftCount;
  updatedWallet.totalNftValueUsd = totalNftValueUsd;
  updatedWallet.totalMainnetValueUsd = totalMainnetVal;
  updatedWallet.totalValueUsd = totalMainnetVal;
  updatedWallet.nonZeroChainsCount = nonZeroCount;
  updatedWallet.hasAnyBalance = nonZeroCount > 0 || totalNftCount > 0;
  updatedWallet.lastScannedAt = Date.now();

  if (errorChains.length > 0) {
    updatedWallet.scanStatus = 'error';
    updatedWallet.error = `${errorChains.length} chain gagal (${errorChains.join(', ')})`;
    logger.warn(
      'SCAN',
      `⚠️ "${wallet.label}": Selesai dengan ${errorChains.length} chain gagal (${errorChains.join(', ')}). Ditandai: Belum Lengkap / Perlu Scan Ulang.`
    );
  } else {
    updatedWallet.scanStatus = 'done';
    updatedWallet.error = undefined;
    logger.info(
      'SCAN',
      `✅ Selesai memindai "${wallet.label}": Total $${totalMainnetVal.toFixed(2)} USD di ${nonZeroCount} jaringan aktif.`
    );
  }

  callbacks?.onWalletComplete?.(updatedWallet);
  return updatedWallet;
}

export async function scanAllWallets(
  wallets: ParsedWalletItem[],
  selectedChains: ChainConfig[] = SUPPORTED_CHAINS,
  callbacks?: ScannerCallbacks,
  signal?: { aborted: boolean }
): Promise<ParsedWalletItem[]> {
  logger.info('SCAN', `🚀 Memulai pemindaian batch untuk ${wallets.length} wallet...`);
  const prices = await fetchLiveCryptoPrices();
  const updatedWallets: ParsedWalletItem[] = [];

  for (let i = 0; i < wallets.length; i++) {
    if (signal?.aborted) {
      logger.warn('SCAN', 'Pemindaian dihentikan oleh pengguna.');
      break;
    }
    const w = wallets[i];

    callbacks?.onProgress?.({
      scannedWallets: i,
      totalWallets: wallets.length,
      currentWalletLabel: w.label,
      currentChain: 'Starting...',
      percent: Math.round((i / wallets.length) * 100),
    });

    const updated = await scanSingleWallet(w, selectedChains, prices, callbacks);
    updatedWallets.push(updated);
  }

  logger.success('SCAN', `🎉 Pemindaian batch selesai! Total ${updatedWallets.length} wallet berhasil diperbarui.`);

  callbacks?.onProgress?.({
    scannedWallets: wallets.length,
    totalWallets: wallets.length,
    currentWalletLabel: 'Finished',
    currentChain: 'Done',
    percent: 100,
  });

  return updatedWallets;
}


