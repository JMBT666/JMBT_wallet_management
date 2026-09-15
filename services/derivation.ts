import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as ed25519 from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { DerivedAccountInfo } from '../types/wallet';

// Helper to safely mask keys/phrases
export function maskSecret(secret: string, type: 'mnemonic' | 'privateKey' | 'address'): string {
  const clean = secret.trim();
  if (type === 'mnemonic') {
    const words = clean.split(/\s+/);
    if (words.length <= 4) return words.map(() => '****').join(' ');
    return `${words[0]} ${words[1]} •••••• ${words[words.length - 1]} (${words.length} words)`;
  }
  if (clean.length > 10) {
    return `${clean.slice(0, 6)}••••••••${clean.slice(-4)}`;
  }
  return '••••••••';
}

export function maskAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Derive EVM address & private key from Hex Private Key
export function deriveFromEvmPrivateKey(privateKey: string): { address: string; privateKey: string } {
  let formattedKey = privateKey.trim();
  if (!formattedKey.startsWith('0x')) {
    formattedKey = '0x' + formattedKey;
  }
  const wallet = new ethers.Wallet(formattedKey);
  return {
    address: wallet.address,
    privateKey: formattedKey,
  };
}

// Derive Solana Keypair from Base58 or Byte Array
export function deriveFromSolanaPrivateKey(keyString: string): { address: string; privateKeyBase58: string } | null {
  try {
    let secretKeyUint8: Uint8Array;
    const trimmed = keyString.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsedArray = JSON.parse(trimmed);
      secretKeyUint8 = new Uint8Array(parsedArray);
    } else {
      secretKeyUint8 = bs58.decode(trimmed);
    }

    let keypair: Keypair;
    if (secretKeyUint8.length === 64) {
      keypair = Keypair.fromSecretKey(secretKeyUint8);
    } else if (secretKeyUint8.length === 32) {
      keypair = Keypair.fromSeed(secretKeyUint8);
    } else {
      return null;
    }

    return {
      address: keypair.publicKey.toBase58(),
      privateKeyBase58: bs58.encode(keypair.secretKey),
    };
  } catch {
    return null;
  }
}

// Helper to derive TRON address from Secp256k1 private key
export function getTronAddressFromPrivateKey(privateKeyHex: string): string {
  try {
    let cleanKey = privateKeyHex.trim().replace(/^0x/, '');
    if (cleanKey.length !== 64) return '';
    const wallet = new ethers.Wallet('0x' + cleanKey);
    const pubKeyBytes = ethers.getBytes(wallet.signingKey.publicKey).slice(1);
    const keccakHash = ethers.keccak256(pubKeyBytes);
    const address20 = ethers.getBytes(keccakHash).slice(12);

    const tron21 = new Uint8Array(21);
    tron21[0] = 0x41; // TRON prefix
    tron21.set(address20, 1);

    const hash1 = ethers.sha256(tron21);
    const hash2 = ethers.sha256(hash1);
    const checksum = ethers.getBytes(hash2).slice(0, 4);

    const finalBytes = new Uint8Array(25);
    finalBytes.set(tron21, 0);
    finalBytes.set(checksum, 21);

    const encodeFn = typeof bs58.encode === 'function' ? bs58.encode : ((bs58 as any).default && (bs58 as any).default.encode);
    return encodeFn ? encodeFn(finalBytes) : '';
  } catch {
    return '';
  }
}

// Bech32 encoding (BIP-173) for Bitcoin & Litecoin Native SegWit
const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  let chk = 1;
  for (let p = 0; p < values.length; ++p) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[p];
    if ((top >> 0) & 1) chk ^= 0x3b2d38bf;
    if ((top >> 1) & 1) chk ^= 0x0562e0e3;
    if ((top >> 2) & 1) chk ^= 0x0e7707e3;
    if ((top >> 3) & 1) chk ^= 0x2bfbbff2;
    if ((top >> 4) & 1) chk ^= 0x3ac422b4;
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let p = 0; p < hrp.length; ++p) ret.push(hrp.charCodeAt(p) >> 5);
  ret.push(0);
  for (let p = 0; p < hrp.length; ++p) ret.push(hrp.charCodeAt(p) & 31);
  return ret;
}

function convertBits(data: Uint8Array | number[], frombits: number, tobits: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << tobits) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    if (value < 0 || (value >> frombits) !== 0) return null;
    acc = (acc << frombits) | value;
    bits += frombits;
    while (bits >= tobits) {
      bits -= tobits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (tobits - bits)) & maxv);
  } else if (bits >= frombits || ((acc << (tobits - bits)) & maxv)) {
    return null;
  }
  return ret;
}

function encodeBech32(hrp: string, data: number[]): string {
  const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = bech32Polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let p = 0; p < 6; ++p) {
    checksum.push((mod >> 5 * (5 - p)) & 31);
  }
  const combined = data.concat(checksum);
  let ret = hrp + '1';
  for (let p = 0; p < combined.length; ++p) {
    ret += BECH32_ALPHABET.charAt(combined[p]);
  }
  return ret;
}

const BTC_BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const RIPPLE_BASE58_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

function base58EncodeWithAlphabet(buffer: Uint8Array, alphabet: string): string {
  const digits: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    str += alphabet[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += alphabet[digits[i]];
  }
  return str;
}

function base58CheckEncodeCustom(payload: Uint8Array, alphabet: string = BTC_BASE58_ALPHABET): string {
  const hash1 = ethers.getBytes(ethers.sha256(payload));
  const hash2 = ethers.getBytes(ethers.sha256(hash1));
  const checksum = hash2.slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return base58EncodeWithAlphabet(full, alphabet);
}

// Derive EVM, Solana, TRON, Bitcoin, Litecoin & XRP from BIP-39 Mnemonic Seed Phrase
export function deriveAccountsFromMnemonic(
  mnemonicPhrase: string,
  accountsCount: number = 1
): {
  evmPrimaryAddress: string;
  solanaPrimaryAddress?: string;
  tronPrimaryAddress?: string;
  btcPrimaryAddress?: string;
  btcLegacyPrimaryAddress?: string;
  ltcPrimaryAddress?: string;
  ltcLegacyPrimaryAddress?: string;
  xrpPrimaryAddress?: string;
  derivedAccounts: DerivedAccountInfo[];
} {
  const cleanMnemonic = mnemonicPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const derivedAccounts: DerivedAccountInfo[] = [];

  // Seed for multi-chain derivation
  const mnemonicObj = ethers.Mnemonic.fromPhrase(cleanMnemonic);
  const seedHex = mnemonicObj.computeSeed();
  const seedBuffer = Buffer.from(seedHex.slice(2), 'hex');
  const rootNode = ethers.HDNodeWallet.fromSeed(seedHex);

  let evmPrimary = '';
  let solanaPrimary = '';
  let tronPrimary = '';
  let btcPrimary = '';
  let btcLegacyPrimary = '';
  let ltcPrimary = '';
  let ltcLegacyPrimary = '';
  let xrpPrimary = '';

  for (let i = 0; i < accountsCount; i++) {
    // 1. EVM Standard Path: m/44'/60'/0'/0/i
    const evmPath = `m/44'/60'/0'/0/${i}`;
    const evmWallet = rootNode.derivePath(evmPath);

    // 2. TRON Standard BIP-44 Path: m/44'/195'/0'/0/i
    let tronAddress: string | undefined;
    let tronPrivateKey: string | undefined;
    try {
      const tronWallet = rootNode.derivePath(`m/44'/195'/0'/0/${i}`);
      tronPrivateKey = tronWallet.privateKey;
      tronAddress = getTronAddressFromPrivateKey(tronWallet.privateKey);
    } catch {
      // ignore
    }

    // 3. Solana Standard Path: m/44'/501'/i'/0'
    let solanaAddress: string | undefined;
    let solanaPrivateKey: string | undefined;
    try {
      const solPath = `m/44'/501'/${i}'/0'`;
      const derivedSeed = ed25519.derivePath(solPath, seedBuffer.toString('hex')).key;
      const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);
      const solKeypair = Keypair.fromSecretKey(keypair.secretKey);
      solanaAddress = solKeypair.publicKey.toBase58();
      solanaPrivateKey = bs58.encode(solKeypair.secretKey);
    } catch {
      // ignore
    }

    // 4. Bitcoin Standard Paths
    let btcAddress: string | undefined;
    let btcLegacyAddress: string | undefined;
    let btcPrivateKey: string | undefined;
    try {
      // Native SegWit (BIP-84, bc1q...)
      const btcBip84Node = rootNode.derivePath(`m/84'/0'/0'/0/${i}`);
      btcPrivateKey = btcBip84Node.privateKey;
      const pubkey84Bytes = ethers.getBytes(btcBip84Node.publicKey);
      const hash160Btc84 = ethers.getBytes(ethers.ripemd160(ethers.sha256(pubkey84Bytes)));
      const conv84 = convertBits(hash160Btc84, 8, 5, true);
      if (conv84) {
        btcAddress = encodeBech32('bc', [0, ...conv84]);
      }

      // Legacy (BIP-44, 1...)
      const btcBip44Node = rootNode.derivePath(`m/44'/0'/0'/0/${i}`);
      const pubkey44Bytes = ethers.getBytes(btcBip44Node.publicKey);
      const hash160Btc44 = ethers.getBytes(ethers.ripemd160(ethers.sha256(pubkey44Bytes)));
      const btcLegacyPayload = new Uint8Array(21);
      btcLegacyPayload[0] = 0x00; // Mainnet P2PKH
      btcLegacyPayload.set(hash160Btc44, 1);
      btcLegacyAddress = base58CheckEncodeCustom(btcLegacyPayload, BTC_BASE58_ALPHABET);
    } catch {
      // ignore
    }

    // 5. Litecoin Standard Paths
    let ltcAddress: string | undefined;
    let ltcLegacyAddress: string | undefined;
    let ltcPrivateKey: string | undefined;
    try {
      // Native SegWit (BIP-84, ltc1q...)
      const ltcBip84Node = rootNode.derivePath(`m/84'/2'/0'/0/${i}`);
      ltcPrivateKey = ltcBip84Node.privateKey;
      const pubkey84Bytes = ethers.getBytes(ltcBip84Node.publicKey);
      const hash160Ltc84 = ethers.getBytes(ethers.ripemd160(ethers.sha256(pubkey84Bytes)));
      const convLtc84 = convertBits(hash160Ltc84, 8, 5, true);
      if (convLtc84) {
        ltcAddress = encodeBech32('ltc', [0, ...convLtc84]);
      }

      // Legacy (BIP-44, L...)
      const ltcBip44Node = rootNode.derivePath(`m/44'/2'/0'/0/${i}`);
      const pubkey44Bytes = ethers.getBytes(ltcBip44Node.publicKey);
      const hash160Ltc44 = ethers.getBytes(ethers.ripemd160(ethers.sha256(pubkey44Bytes)));
      const ltcLegacyPayload = new Uint8Array(21);
      ltcLegacyPayload[0] = 0x30; // Mainnet LTC P2PKH (starts with L)
      ltcLegacyPayload.set(hash160Ltc44, 1);
      ltcLegacyAddress = base58CheckEncodeCustom(ltcLegacyPayload, BTC_BASE58_ALPHABET);
    } catch {
      // ignore
    }

    // 6. Ripple XRP Standard Path (m/44'/144'/0'/0/i)
    let xrpAddress: string | undefined;
    try {
      const xrpNode = rootNode.derivePath(`m/44'/144'/0'/0/${i}`);
      const pubkeyBytes = ethers.getBytes(xrpNode.publicKey);
      const hash160Xrp = ethers.getBytes(ethers.ripemd160(ethers.sha256(pubkeyBytes)));
      const xrpPayload = new Uint8Array(21);
      xrpPayload[0] = 0x00; // Ripple address version byte 0
      xrpPayload.set(hash160Xrp, 1);
      xrpAddress = base58CheckEncodeCustom(xrpPayload, RIPPLE_BASE58_ALPHABET);
    } catch {
      // ignore
    }

    if (i === 0) {
      evmPrimary = evmWallet.address;
      solanaPrimary = solanaAddress || '';
      tronPrimary = tronAddress || '';
      btcPrimary = btcAddress || '';
      btcLegacyPrimary = btcLegacyAddress || '';
      ltcPrimary = ltcAddress || '';
      ltcLegacyPrimary = ltcLegacyAddress || '';
      xrpPrimary = xrpAddress || '';
    }

    derivedAccounts.push({
      index: i,
      path: evmPath,
      evmAddress: evmWallet.address,
      solanaAddress,
      tronAddress,
      btcAddress,
      btcLegacyAddress,
      ltcAddress,
      ltcLegacyAddress,
      xrpAddress,
      evmPrivateKey: evmWallet.privateKey,
      solanaPrivateKey,
      tronPrivateKey,
      btcPrivateKey,
      ltcPrivateKey,
      chainAssets: {},
      totalValueUsd: 0,
      hasBalance: false,
    });
  }

  return {
    evmPrimaryAddress: evmPrimary,
    solanaPrimaryAddress: solanaPrimary,
    tronPrimaryAddress: tronPrimary,
    btcPrimaryAddress: btcPrimary,
    btcLegacyPrimaryAddress: btcLegacyPrimary,
    ltcPrimaryAddress: ltcPrimary,
    ltcLegacyPrimaryAddress: ltcLegacyPrimary,
    xrpPrimaryAddress: xrpPrimary,
    derivedAccounts,
  };
}

