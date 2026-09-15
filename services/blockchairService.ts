import { logger } from './logger';

const BLOCKCHAIR_ENABLED_STORAGE = 'jmbt_blockchair_enabled_v1';

export function isBlockchairEnabled(): boolean {
  try {
    const val = localStorage.getItem(BLOCKCHAIR_ENABLED_STORAGE);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveBlockchairEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BLOCKCHAIR_ENABLED_STORAGE, enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Error saving Blockchair enabled flag:', err);
  }
}

/**
 * Mendapatkan tautan langsung ke Blockchair Explorer
 */
export function getBlockchairAddressUrl(chainType: 'solana' | 'evm', address: string, chainShortName?: string): string {
  if (chainType === 'solana') {
    return `https://blockchair.com/solana/address/${address}`;
  }
  const s = (chainShortName || '').toLowerCase();
  if (s === 'eth') return `https://blockchair.com/ethereum/address/${address}`;
  if (s === 'bsc') return `https://blockchair.com/bnb/address/${address}`;
  if (s === 'pol') return `https://blockchair.com/polygon/address/${address}`;
  if (s === 'arb') return `https://blockchair.com/arbitrum-one/address/${address}`;
  if (s === 'base') return `https://blockchair.com/base/address/${address}`;
  if (s === 'op') return `https://blockchair.com/optimism/address/${address}`;
  if (s === 'avax') return `https://blockchair.com/avalanche/address/${address}`;
  if (s === 'linea') return `https://blockchair.com/linea/address/${address}`;
  
  // Default multi-chain search
  return `https://blockchair.com/search?q=${address}`;
}

export function getBlockchairSearchUrl(address: string): string {
  return `https://blockchair.com/search?q=${address}`;
}

export interface BlockchairBalanceResult {
  nativeBalance: string;
  nativeValueUsd: number;
  hasBalance: boolean;
  source: 'blockchair';
}

/**
 * Parser Elemen DOM / HTML Halaman Address Blockchair
 * Mengekstrak blok:
 * <h2 class="| caption | | uppercase">Main balance</h2>
 * <span class="wb-ba"><span class="color-text-success">+</span> 0.001457994</span>&nbsp;SOL&nbsp;
 * <span class="wb-bw">0.15</span>&nbsp;USD
 */
export function parseBlockchairAddressHtml(html: string): { balance: string; balanceUsd: number; symbol: string; hasBalance: boolean } | null {
  if (!html || typeof html !== 'string') return null;

  try {
    const mainBalIdx = html.indexOf('Main balance');
    if (mainBalIdx === -1) {
      // Fallback pencarian alternatif jika teks lower case
      const lowerIdx = html.toLowerCase().indexOf('main balance');
      if (lowerIdx === -1) return null;
    }

    const startIdx = mainBalIdx !== -1 ? mainBalIdx : html.toLowerCase().indexOf('main balance');
    // Ambil chunk sekitar 1200 karakter setelah heading
    const chunk = html.slice(startIdx, startIdx + 1200);

    // 1. Ekstrak Saldo & Simbol Koin
    // Format: ...>0.001457994</span>&nbsp;SOL&nbsp; atau ...>0.00</span>&nbsp;ETH
    let balance = '0';
    let symbol = 'SOL';
    const balRegex = /([0-9]+\.?[0-9]*)\s*<\/span>\s*(?:&nbsp;|\s)*([A-Za-z0-9]+)/i;
    const balMatch = chunk.match(balRegex);
    if (balMatch) {
      balance = balMatch[1];
      symbol = balMatch[2].toUpperCase();
    }

    // 2. Ekstrak Saldo USD
    // Format: <span class="wb-bw">0.15</span>&nbsp;USD
    let balanceUsd = 0;
    const usdRegex = /([0-9]+\.?[0-9]*)\s*<\/span>\s*(?:&nbsp;|\s)*USD/i;
    const usdMatch = chunk.match(usdRegex);
    if (usdMatch) {
      balanceUsd = parseFloat(usdMatch[1]) || 0;
    }

    const numBal = parseFloat(balance);
    return {
      balance: numBal > 0 ? balance : '0',
      balanceUsd,
      symbol,
      hasBalance: numBal > 0
    };
  } catch (err) {
    console.error('Error parsing Blockchair address HTML:', err);
    return null;
  }
}

/**
 * Parser Elemen DOM / HTML Halaman Search Blockchair
 * Mengambil daftar blockchain yang cocok dari:
 * <a class="search-result ..." href="https://blockchair.com/{chain}/address/{address}">
 */
export function parseBlockchairSearchHtml(html: string): string[] {
  if (!html) return [];
  const chains: string[] = [];
  try {
    const regex = /href=["']https:\/\/blockchair\.com\/([a-z0-9-]+)\/address\/(?:0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (m[1] && !chains.includes(m[1])) {
        chains.push(m[1]);
      }
    }
  } catch (err) {
    console.error('Error parsing Blockchair search HTML:', err);
  }
  return chains;
}

/**
 * Fetch HTML langsung tanpa API Key
 * Multi-Tier:
 * 1. Local Vite proxy (/blockchair-proxy/...)
 * 2. Public CORS fallback proxy
 */
export async function fetchBlockchairHtml(path: string, timeoutMs: number = 7000): Promise<string | null> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = `https://blockchair.com${cleanPath}`;

  // Daftar endpoint untuk dicoba secara berurutan
  const attempts = [
    // Tier 1: Local dev server proxy (Bypass CORS sepenuhnya di local)
    `/blockchair-proxy${cleanPath}`,
    // Tier 2: Public CORS proxies
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
  ];

  for (const url of attempts) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      clearTimeout(id);

      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 500 && (text.includes('Blockchair') || text.includes('Main balance') || text.includes('search-result'))) {
          return text;
        }
      }
    } catch {
      // lanjut ke attempt berikutnya
    }
  }

  return null;
}

/**
 * Fetch Solana balance dari Blockchair via HTML Fetching (Tanpa API Key)
 */
export async function fetchBlockchairSolanaBalance(
  address: string,
  walletLabel: string = ''
): Promise<BlockchairBalanceResult | null> {
  if (!isBlockchairEnabled()) return null;

  try {
    const path = `/solana/address/${address}`;
    const html = await fetchBlockchairHtml(path);
    if (!html) return null;

    const parsed = parseBlockchairAddressHtml(html);
    if (parsed) {
      logger.success('SCAN', `✅ [Solana Blockchair HTML Fetch] ${walletLabel || address.slice(0, 6)}: Ditemukan ${parsed.balance} SOL ($${parsed.balanceUsd.toFixed(2)})`);
      return {
        nativeBalance: parsed.balance,
        nativeValueUsd: parsed.balanceUsd,
        hasBalance: parsed.hasBalance,
        source: 'blockchair'
      };
    }
  } catch (err: any) {
    // Fail silently to normal flow
  }
  return null;
}

/**
 * Fetch EVM balance dari Blockchair via HTML Fetching (Tanpa API Key)
 */
export async function fetchBlockchairEvmBalance(
  address: string,
  chainSlug: string,
  walletLabel: string = ''
): Promise<BlockchairBalanceResult | null> {
  if (!isBlockchairEnabled()) return null;

  const chainMap: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    bsc: 'bnb',
    bnb: 'bnb',
    pol: 'polygon',
    polygon: 'polygon',
    arb: 'arbitrum-one',
    arbitrum: 'arbitrum-one',
    base: 'base',
    op: 'optimism',
    optimism: 'optimism',
    avax: 'avalanche',
    avalanche: 'avalanche',
    linea: 'linea',
  };

  const bcChain = chainMap[chainSlug.toLowerCase()];
  if (!bcChain) return null;

  try {
    const path = `/${bcChain}/address/${address}`;
    const html = await fetchBlockchairHtml(path);
    if (!html) return null;

    const parsed = parseBlockchairAddressHtml(html);
    if (parsed) {
      logger.success('SCAN', `✅ [${chainSlug.toUpperCase()} Blockchair HTML Fetch] ${walletLabel || address.slice(0, 6)}: Ditemukan ${parsed.balance} ${parsed.symbol} ($${parsed.balanceUsd.toFixed(2)})`);
      return {
        nativeBalance: parsed.balance,
        nativeValueUsd: parsed.balanceUsd,
        hasBalance: parsed.hasBalance,
        source: 'blockchair'
      };
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Uji Coba Direct HTML Fetching Blockchair (Tanpa API Key)
 */
export async function testBlockchairFetching(): Promise<{ success: boolean; ms?: number; message?: string; sampleBalance?: string }> {
  const start = performance.now();
  try {
    // Gunakan sampel Solana yang diberikan pengguna
    const sampleAddress = 'oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96';
    const html = await fetchBlockchairHtml(`/solana/address/${sampleAddress}`, 8000);
    const elapsed = Math.round(performance.now() - start);

    if (html) {
      const parsed = parseBlockchairAddressHtml(html);
      if (parsed) {
        return {
          success: true,
          ms: elapsed,
          sampleBalance: `${parsed.balance} SOL ($${parsed.balanceUsd.toFixed(2)})`,
          message: `Berhasil ambil & parse HTML (${elapsed}ms) - Saldo: ${parsed.balance} SOL ($${parsed.balanceUsd.toFixed(2)})`
        };
      }
      return {
        success: true,
        ms: elapsed,
        message: `HTML didapat (${elapsed}ms, ${Math.round(html.length / 1024)} KB), struktur parsing perlu penyesuaian.`
      };
    }

    return {
      success: false,
      message: `Gagal mengambil HTML (Koneksi dibatasi/timeout). Gunakan tombol link langsung Blockchair.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error: ${err.message || 'Koneksi gagal'}`
    };
  }
}

