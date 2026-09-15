import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { ParsedWalletItem, WalletType, DerivedAccountInfo } from '../types/wallet';
import {
  deriveAccountsFromMnemonic,
  deriveFromEvmPrivateKey,
  deriveFromSolanaPrivateKey,
  getTronAddressFromPrivateKey,
  maskSecret,
} from './derivation';

// Pre-compute O(1) BIP-39 English Wordlist Set
const BIP39_WORD_SET = new Set<string>();
for (let i = 0; i < 2048; i++) {
  BIP39_WORD_SET.add(ethers.wordlists.en.getWord(i));
}

export interface RawParsedItem {
  id: string;
  lineNumber: number;
  type: WalletType;
  label: string;
  rawSecret: string;
  rawInput: string;
  tags?: string[];
  evmAddress?: string;
  solanaAddress?: string;
  tronAddress?: string;
  btcAddress?: string;
  btcLegacyAddress?: string;
  ltcAddress?: string;
  ltcLegacyAddress?: string;
  xrpAddress?: string;
}

export interface ParseResult {
  items: RawParsedItem[];
  wallets: ParsedWalletItem[];
  stats: {
    totalLines: number;
    parsedCount: number;
    mnemonicsCount: number;
    privateKeysCount: number;
    addressesCount: number;
    duplicatesCount: number;
    invalidCount: number;
  };
  errors: { line: number; text: string; reason: string }[];
}

export interface ParseProgress {
  currentLine: number;
  totalLines: number;
  percent: number;
  stats: {
    parsedCount: number;
    mnemonicsCount: number;
    privateKeysCount: number;
    addressesCount: number;
    duplicatesCount: number;
    invalidCount: number;
  };
}

/**
 * Intelligent Mnemonic Extractor:
 * Handles standard mnemonics AND mnemonics cluttered with numbering or delimiters, such as:
 * - "1 phrase1 2 phrase2 ... 12 phrase12"
 * - "1. phrase1 2. phrase2 ... 12. phrase12"
 * - "1-phrase1 2-phrase2 ... 12-phrase12"
 * - "1: phrase1, 2: phrase2, ... 12: phrase12"
 * - "[1] phrase1 [2] phrase2 ... [12] phrase12"
 * - Words surrounded by custom prefix/suffix notes: "seed: 1. word1 ... 12. word12 # my backup"
 */
export function extractCleanMnemonic(rawText: string): string | null {
  if (!rawText || rawText.length < 20) return null;

  // Replace common delimiters (commas, semicolons, pipes, tabs) with spaces
  const normalized = rawText.replace(/[,;|\t]+/g, ' ');
  const tokens = normalized.trim().split(/\s+/);
  const candidateWords: string[] = [];

  for (const token of tokens) {
    // Skip standalone index/numbering tokens (e.g., "1", "1.", "1:", "1)", "[1]", "#1", "01.")
    if (/^[#\[\(]?\d+[\.\:\)\-\]\/]*$/.test(token)) {
      continue;
    }

    // Clean word from number prefixes or punctuation (e.g. "1.abandon" -> "abandon", "1-about" -> "about")
    const cleaned = token
      .toLowerCase()
      .replace(/^[#\[\(]?\d+[\.\:\)\-\]\/]*/, '')
      .replace(/[\.\:\)\-\]\/]+$/, '');

    if (cleaned && /^[a-z]+$/.test(cleaned) && BIP39_WORD_SET.has(cleaned)) {
      candidateWords.push(cleaned);
    }
  }

  // Fast check: if candidate words are fewer than 12 or greater than 28, cannot be a mnemonic
  if (candidateWords.length < 12 || candidateWords.length > 28) return null;

  const validLengths = [12, 15, 18, 21, 24];

  // 1. Direct match if exact candidate word count is a standard mnemonic length
  if (validLengths.includes(candidateWords.length)) {
    const phrase = candidateWords.join(' ');
    if (ethers.Mnemonic.isValidMnemonic(phrase)) {
      return phrase;
    }
  }

  // 2. Sliding window search if line has extra words, notes, or labels attached (max 28 words)
  for (const len of [24, 21, 18, 15, 12]) {
    if (candidateWords.length >= len) {
      for (let i = 0; i <= candidateWords.length - len; i++) {
        const sub = candidateWords.slice(i, i + len);
        const phrase = sub.join(' ');
        if (ethers.Mnemonic.isValidMnemonic(phrase)) {
          return phrase;
        }
      }
    }
  }

  return null;
}

// Fast pre-filter: discard empty lines, comments, or non-alphanumeric lines in < 1 microsecond
function isWorthChecking(line: string): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  if (trimmed.length < 8) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return false;
  return /[a-zA-Z0-9]/.test(trimmed);
}

// Clean and extract potential custom inline tag/comment
function extractInlineLabelAndSecret(rawLine: string): { cleanSecret: string; extractedLabel?: string } {
  let text = rawLine.trim();

  // Strip leading list bullets/numbering like "1. ", "1) ", "[1] ", "1: ", "- ", "* "
  text = text.replace(/^(\d+[\.\)\:\-]\s*|\[\d+\]\s*|[\-\*]\s*)/, '').trim();

  // Strip surrounding quotes
  text = text.replace(/^["'`]|["'`]$/g, '').trim();

  // Remove trailing commas or semicolons
  text = text.replace(/[,;]+$/, '').trim();

  let extractedLabel: string | undefined;

  // Check for colon separation: "My Main Wallet: 0x1234..."
  if (text.includes(':')) {
    const colonIndex = text.indexOf(':');
    const partBefore = text.slice(0, colonIndex).trim();
    const partAfter = text.slice(colonIndex + 1).trim();

    if (partAfter.length >= 32 || partAfter.split(/\s+/).length >= 12) {
      extractedLabel = partBefore;
      text = partAfter;
    }
  }

  // Check for trailing comments like "0x1234... // Airdrop 1" or "... # Binance"
  const commentMatch = text.match(/\s+(\/\/|#|--)\s*(.+)$/);
  if (commentMatch) {
    extractedLabel = extractedLabel || commentMatch[2].trim();
    text = text.slice(0, commentMatch.index).trim();
  }

  return { cleanSecret: text, extractedLabel };
}

// Fast Single Line Parser (instant regex/bip39 check without PBKDF2 delay)
export function parseSingleLineFast(
  originalLine: string,
  lineNumber: number,
  options: { defaultTag?: string } = {}
): { item?: RawParsedItem; error?: { line: number; text: string; reason: string } } {
  if (!isWorthChecking(originalLine)) {
    return {
      error: {
        line: lineNumber,
        text: originalLine.length > 50 ? originalLine.slice(0, 47) + '...' : originalLine,
        reason: 'Baris kosong, komentar, atau karakter tidak valid',
      },
    };
  }

  const { cleanSecret, extractedLabel } = extractInlineLabelAndSecret(originalLine);
  if (!cleanSecret) {
    return {
      error: { line: lineNumber, text: originalLine, reason: 'Konten kosong setelah dibersihkan' },
    };
  }

  let walletType: WalletType | null = null;
  let rawSecret = cleanSecret;
  let evmAddress: string | undefined;
  let solanaAddress: string | undefined;
  let tronAddress: string | undefined;
  let btcAddress: string | undefined;
  let btcLegacyAddress: string | undefined;
  let ltcAddress: string | undefined;
  let ltcLegacyAddress: string | undefined;
  let xrpAddress: string | undefined;

  // 1. Mnemonic Check (instant BIP39 wordset & checksum check in 0.01ms)
  const extractedMnemonic = extractCleanMnemonic(originalLine) || extractCleanMnemonic(cleanSecret);
  if (extractedMnemonic) {
    walletType = 'mnemonic';
    rawSecret = extractedMnemonic;
  }

  // 2. Hex EVM Private Key (64 hex characters)
  if (!walletType) {
    const hexKeyMatch = cleanSecret.match(/^(?:0x)?([0-9a-fA-F]{64})$/);
    if (hexKeyMatch) {
      walletType = 'privateKey';
      rawSecret = hexKeyMatch[1].startsWith('0x') ? hexKeyMatch[1] : '0x' + hexKeyMatch[1];
    }
  }

  // 3. Solana Private Key (Base58 64-88 chars or JSON byte array)
  if (!walletType) {
    if ((cleanSecret.startsWith('[') && cleanSecret.endsWith(']')) || /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(cleanSecret)) {
      walletType = 'privateKey';
      rawSecret = cleanSecret;
    }
  }

  // 4. Raw EVM Address (0x + 40 hex characters)
  if (!walletType) {
    const evmAddrMatch = cleanSecret.match(/^(0x[0-9a-fA-F]{40})$/);
    if (evmAddrMatch && ethers.isAddress(evmAddrMatch[1])) {
      walletType = 'address';
      evmAddress = ethers.getAddress(evmAddrMatch[1]);
      rawSecret = evmAddress;
    }
  }

  // 5. Raw TRON Address (Base58 34 characters starting with T)
  if (!walletType) {
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanSecret)) {
      walletType = 'address';
      tronAddress = cleanSecret;
      rawSecret = cleanSecret;
    }
  }

  // 6. Raw Bitcoin Address (Native SegWit bc1... or Legacy 1.../3...)
  if (!walletType) {
    if (/^bc1[a-zA-HJ-NP-Z0-9]{25,65}$/i.test(cleanSecret)) {
      walletType = 'address';
      btcAddress = cleanSecret;
      rawSecret = cleanSecret;
    } else if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanSecret)) {
      walletType = 'address';
      btcLegacyAddress = cleanSecret;
      rawSecret = cleanSecret;
    }
  }

  // 7. Raw Litecoin Address (Native SegWit ltc1... or Legacy L.../M...)
  if (!walletType) {
    if (/^ltc1[a-zA-HJ-NP-Z0-9]{25,65}$/i.test(cleanSecret)) {
      walletType = 'address';
      ltcAddress = cleanSecret;
      rawSecret = cleanSecret;
    } else if (/^[LM][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanSecret)) {
      walletType = 'address';
      ltcLegacyAddress = cleanSecret;
      rawSecret = cleanSecret;
    }
  }

  // 8. Raw Ripple XRP Address (r...)
  if (!walletType) {
    if (/^r[1-9A-HJ-NP-Za-km-z]{25,35}$/.test(cleanSecret)) {
      walletType = 'address';
      xrpAddress = cleanSecret;
      rawSecret = cleanSecret;
    }
  }

  // 9. Raw Solana Address (Base58 32-44 characters)
  if (!walletType) {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanSecret)) {
      walletType = 'address';
      solanaAddress = cleanSecret;
      rawSecret = cleanSecret;
    }
  }

  if (!walletType) {
    return {
      error: {
        line: lineNumber,
        text: originalLine.length > 50 ? originalLine.slice(0, 47) + '...' : originalLine,
        reason: 'Format tidak dikenali',
      },
    };
  }

  const walletLabel = extractedLabel || `Wallet #${lineNumber} (${walletType})`;
  const tags: string[] = [];
  if (options.defaultTag) tags.push(options.defaultTag);

  return {
    item: {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      lineNumber,
      type: walletType,
      label: walletLabel,
      rawSecret,
      rawInput: originalLine,
      tags,
      evmAddress,
      solanaAddress,
      tronAddress,
      btcAddress,
      btcLegacyAddress,
      ltcAddress,
      ltcLegacyAddress,
      xrpAddress,
    },
  };
}

/**
 * Derives full addresses and sub-accounts for items asynchronously with 60 FPS time-slicing.
 */
export async function deriveWalletsAsync(
  rawItems: RawParsedItem[],
  accountsPerMnemonic: number = 1,
  defaultTag?: string,
  onProgress?: (progress: { current: number; total: number; percent: number }) => void,
  signal?: { aborted: boolean }
): Promise<ParsedWalletItem[]> {
  const wallets: ParsedWalletItem[] = [];
  const total = rawItems.length;
  let lastYield = performance.now();

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;
    const item = rawItems[i];
    let evmAddress = item.evmAddress;
    let solanaAddress = item.solanaAddress;
    let tronAddress = item.tronAddress;
    let btcAddress = item.btcAddress;
    let btcLegacyAddress = item.btcLegacyAddress;
    let ltcAddress = item.ltcAddress;
    let ltcLegacyAddress = item.ltcLegacyAddress;
    let xrpAddress = item.xrpAddress;
    let derivedAccounts: DerivedAccountInfo[] | undefined;

    if (item.type === 'mnemonic') {
      try {
        const derived = deriveAccountsFromMnemonic(item.rawSecret, accountsPerMnemonic);
        evmAddress = derived.evmPrimaryAddress;
        solanaAddress = derived.solanaPrimaryAddress;
        tronAddress = derived.tronPrimaryAddress;
        btcAddress = derived.btcPrimaryAddress;
        btcLegacyAddress = derived.btcLegacyPrimaryAddress;
        ltcAddress = derived.ltcPrimaryAddress;
        ltcLegacyAddress = derived.ltcLegacyPrimaryAddress;
        xrpAddress = derived.xrpPrimaryAddress;
        derivedAccounts = derived.derivedAccounts;
      } catch {
        continue;
      }
    } else if (item.type === 'privateKey') {
      if (!evmAddress && !solanaAddress && !tronAddress) {
        if (/^(?:0x)?[0-9a-fA-F]{64}$/.test(item.rawSecret)) {
          try {
            const derived = deriveFromEvmPrivateKey(item.rawSecret);
            evmAddress = derived.address;
            tronAddress = getTronAddressFromPrivateKey(item.rawSecret);
          } catch {}
        } else {
          try {
            const solResult = deriveFromSolanaPrivateKey(item.rawSecret);
            if (solResult) solanaAddress = solResult.address;
          } catch {}
        }
      }
    }

    const tags: string[] = [];
    if (defaultTag) tags.push(defaultTag);
    if (item.tags) tags.push(...item.tags);

    wallets.push({
      id: item.id,
      rawInput: item.rawInput,
      lineNumber: item.lineNumber,
      type: item.type,
      label: item.label,
      tags,
      maskedSecret: maskSecret(item.rawSecret, item.type),
      rawSecret: item.rawSecret,
      evmAddress,
      solanaAddress,
      tronAddress,
      btcAddress,
      btcLegacyAddress,
      ltcAddress,
      ltcLegacyAddress,
      xrpAddress,
      derivedAccounts,
      chainAssets: {},
      totalValueUsd: 0,
      totalMainnetValueUsd: 0,
      nonZeroChainsCount: 0,
      hasAnyBalance: false,
      scanStatus: 'idle',
      createdAt: Date.now(),
    });

    const now = performance.now();
    if (now - lastYield >= 16 || i === total - 1) {
      lastYield = now;
      onProgress?.({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return wallets;
}

// Turbo Asynchronous Parser: scans 300,000+ lines in ~7 seconds with 60 FPS time-slicing
export async function parseWalletsFromTextAsync(
  inputText: string,
  options: {
    accountsPerMnemonic?: number;
    defaultTag?: string;
  } = {},
  onProgress?: (progress: ParseProgress) => void,
  signal?: { aborted: boolean }
): Promise<ParseResult> {
  const lines = inputText.split(/\r?\n/);
  const totalLines = lines.length;

  const rawItems: RawParsedItem[] = [];
  const errorSamples: { line: number; text: string; reason: string }[] = [];
  const maxErrorSamples = 30;

  const seenIdentifiers = new Set<string>();

  let mnemonicsCount = 0;
  let privateKeysCount = 0;
  let addressesCount = 0;
  let duplicatesCount = 0;
  let invalidCount = 0;

  let lastYieldTime = performance.now();

  for (let i = 0; i < totalLines; i++) {
    if (signal?.aborted) break;

    const line = lines[i];
    const lineNum = i + 1;

    if (!line || !line.trim() || line.trim().startsWith('#') || line.trim().startsWith('//')) {
      invalidCount++;
      continue;
    }

    const parsed = parseSingleLineFast(line, lineNum, options);
    if (parsed.error) {
      invalidCount++;
      if (errorSamples.length < maxErrorSamples) {
        errorSamples.push(parsed.error);
      }
    } else if (parsed.item) {
      const item = parsed.item;
      const dedupKey = item.rawSecret.toLowerCase();
      if (seenIdentifiers.has(dedupKey)) {
        duplicatesCount++;
      } else {
        seenIdentifiers.add(dedupKey);
        rawItems.push(item);

        if (item.type === 'mnemonic') mnemonicsCount++;
        else if (item.type === 'privateKey') privateKeysCount++;
        else if (item.type === 'address') addressesCount++;
      }
    }

    // Time-based 16ms yield: guarantees 60 FPS smooth progress update without blocking UI
    const now = performance.now();
    if (now - lastYieldTime >= 16 || i === totalLines - 1) {
      lastYieldTime = now;
      onProgress?.({
        currentLine: i + 1,
        totalLines,
        percent: Math.round(((i + 1) / totalLines) * 100),
        stats: {
          parsedCount: rawItems.length,
          mnemonicsCount,
          privateKeysCount,
          addressesCount,
          duplicatesCount,
          invalidCount,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Pre-derive wallets if count is <= 200 items for instant 1-click import
  let wallets: ParsedWalletItem[] = [];
  if (rawItems.length <= 200 && !signal?.aborted) {
    wallets = await deriveWalletsAsync(
      rawItems,
      options.accountsPerMnemonic || 1,
      options.defaultTag,
      undefined,
      signal
    );
  }

  return {
    items: rawItems,
    wallets,
    stats: {
      totalLines,
      parsedCount: rawItems.length,
      mnemonicsCount,
      privateKeysCount,
      addressesCount,
      duplicatesCount,
      invalidCount,
    },
    errors: errorSamples,
  };
}

// Export cleaned secrets (mnemonics, private keys, addresses)
export function getCleanedExportText(items: (RawParsedItem | ParsedWalletItem)[]): string {
  return items.map((w) => w.rawSecret).join('\n');
}

