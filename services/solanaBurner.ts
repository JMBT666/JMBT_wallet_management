import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID, 
  createBurnInstruction, 
  createCloseAccountInstruction 
} from '@solana/spl-token';
import bs58 from 'bs58';
import * as ed25519 from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { ethers } from 'ethers';
import { ParsedWalletItem } from '../types/wallet';
import { logger } from './logger';

export interface SolanaAccountTokenInfo {
  pubkey: string;
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  rawAmount: string;
  decimals: number;
  programId: string;
  rentSol: number;
  isBurnable: boolean;
}

export interface SolanaWalletBurnSummary {
  walletId: string;
  walletLabel: string;
  solanaAddress: string;
  keypair: Keypair | null;
  nativeSolBalance: number;
  tokenAccounts: SolanaAccountTokenInfo[];
  totalReclaimableRentSol: number;
  estimatedTotalSolToTransfer: number;
  status: 'idle' | 'scanning' | 'ready' | 'processing' | 'success' | 'skipped' | 'error';
  txSignature?: string;
  error?: string;
  message?: string;
  isSkipped?: boolean;
}

export interface BurnSweepResult {
  success: boolean;
  skipped?: boolean;
  signature?: string;
  error?: string;
  message?: string;
  reclaimedSol: number;
}

export function getSolanaKeypairFromWallet(wallet: ParsedWalletItem): Keypair | null {
  try {
    if (wallet.type === 'mnemonic') {
      const cleanMnemonic = wallet.rawSecret.trim().toLowerCase().replace(/\s+/g, ' ');
      const mnemonicObj = ethers.Mnemonic.fromPhrase(cleanMnemonic);
      const seedHex = mnemonicObj.computeSeed();
      const seedBuffer = Buffer.from(seedHex.slice(2), 'hex');
      const derivedSeed = ed25519.derivePath("m/44'/501'/0'/0'", seedBuffer.toString('hex')).key;
      const keypairNacl = nacl.sign.keyPair.fromSeed(derivedSeed);
      return Keypair.fromSecretKey(keypairNacl.secretKey);
    } else if (wallet.type === 'privateKey') {
      const secret = wallet.rawSecret.trim();
      let secretKeyUint8: Uint8Array;
      if (secret.startsWith('[') && secret.endsWith(']')) {
        secretKeyUint8 = new Uint8Array(JSON.parse(secret));
      } else {
        secretKeyUint8 = bs58.decode(secret);
      }
      if (secretKeyUint8.length === 64) {
        return Keypair.fromSecretKey(secretKeyUint8);
      } else if (secretKeyUint8.length === 32) {
        return Keypair.fromSeed(secretKeyUint8);
      }
    }
  } catch {
    // derivation failed
  }
  return null;
}

export async function scanSolanaTokenAccountsForBurn(
  solanaAddress: string,
  connection: Connection
): Promise<{ tokenAccounts: SolanaAccountTokenInfo[]; nativeSol: number }> {
  const pubkey = new PublicKey(solanaAddress);
  const nativeLamports = await connection.getBalance(pubkey);
  const nativeSol = nativeLamports / LAMPORTS_PER_SOL;

  const tokenAccounts: SolanaAccountTokenInfo[] = [];

  try {
    const stdAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    for (const { pubkey: accPubkey, account } of stdAccounts.value) {
      const info = account.data.parsed?.info;
      if (info) {
        const amount = parseFloat(info.tokenAmount.uiAmountString || '0');
        tokenAccounts.push({
          pubkey: accPubkey.toBase58(),
          mint: info.mint,
          symbol: info.mint.slice(0, 4) + '...' + info.mint.slice(-4),
          name: amount === 0 ? 'Empty Token Account (Rent locked)' : 'SPL Token',
          balance: amount,
          rawAmount: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          programId: TOKEN_PROGRAM_ID.toBase58(),
          rentSol: 0.00203928,
          isBurnable: true,
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    const t22Accounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_2022_PROGRAM_ID,
    });

    for (const { pubkey: accPubkey, account } of t22Accounts.value) {
      const info = account.data.parsed?.info;
      if (info) {
        const amount = parseFloat(info.tokenAmount.uiAmountString || '0');
        tokenAccounts.push({
          pubkey: accPubkey.toBase58(),
          mint: info.mint,
          symbol: info.mint.slice(0, 4) + '...' + info.mint.slice(-4),
          name: amount === 0 ? 'Empty Token-2022 Account' : 'Token-2022 SPL',
          balance: amount,
          rawAmount: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          programId: TOKEN_2022_PROGRAM_ID.toBase58(),
          rentSol: 0.00203928,
          isBurnable: true,
        });
      }
    }
  } catch {
    // ignore
  }

  logger.info('BURN', `[Solana Rent Scan] ${solanaAddress.slice(0, 6)}: ${tokenAccounts.length} akun token terdeteksi (~${(tokenAccounts.length * 0.002039).toFixed(4)} SOL rent), Native: ${nativeSol.toFixed(4)} SOL`);

  return { tokenAccounts, nativeSol };
}

export async function executeBurnAndSweepForWallet(
  walletSummary: SolanaWalletBurnSummary,
  destinationAddress: string,
  options: {
    burnAndCloseTokens: boolean;
    sweepNativeSol: boolean;
    selectedTokenAccountPubkeys?: string[];
  },
  connection: Connection
): Promise<BurnSweepResult> {
  const keypair = walletSummary.keypair;
  if (!keypair) {
    logger.error('BURN', `[${walletSummary.walletLabel}] Keypair tidak tersedia (Watch-Only)`);
    return { success: false, error: 'Kunci rahasia tidak ditemukan', reclaimedSol: 0 };
  }

  let destPubkey: PublicKey;
  try {
    destPubkey = new PublicKey(destinationAddress.trim());
  } catch {
    logger.error('BURN', `Alamat tujuan ${destinationAddress} tidak valid`);
    return { success: false, error: 'Alamat tujuan Solana tidak valid', reclaimedSol: 0 };
  }

  try {
    logger.info('BURN', `[${walletSummary.walletLabel}] Mempersiapkan proses Burn & Rent Reclaim...`);
    let accountsClosedCount = 0;
    let lastSignature = '';

    const selectedPubkeySet = options.selectedTokenAccountPubkeys
      ? new Set(options.selectedTokenAccountPubkeys)
      : new Set(walletSummary.tokenAccounts.map((t) => t.pubkey));

    // 1. BURN & CLOSE TOKEN ACCOUNTS (Batching 6 accounts per transaction to prevent MTU overflow)
    if (options.burnAndCloseTokens) {
      const tokensToClose = walletSummary.tokenAccounts.filter((t) => selectedPubkeySet.has(t.pubkey));
      
      const BATCH_SIZE = 6;
      for (let i = 0; i < tokensToClose.length; i += BATCH_SIZE) {
        const batch = tokensToClose.slice(i, i + BATCH_SIZE);
        const batchTx = new Transaction();

        for (const tok of batch) {
          const tokenAccPubkey = new PublicKey(tok.pubkey);
          const mintPubkey = new PublicKey(tok.mint);
          const progId = new PublicKey(tok.programId);

          if (tok.balance > 0 && BigInt(tok.rawAmount) > 0n) {
            batchTx.add(
              createBurnInstruction(
                tokenAccPubkey,
                mintPubkey,
                keypair.publicKey,
                BigInt(tok.rawAmount),
                [],
                progId
              )
            );
          }

          // Close account: Rent is reclaimed directly to destPubkey (the backup wallet)
          batchTx.add(
            createCloseAccountInstruction(
              tokenAccPubkey,
              destPubkey,
              keypair.publicKey,
              [],
              progId
            )
          );
        }

        if (batchTx.instructions.length > 0) {
          logger.info('BURN', `[${walletSummary.walletLabel}] Menutup ${batch.length} akun token SPL (Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tokensToClose.length / BATCH_SIZE)})...`);
          lastSignature = await sendAndConfirmTransaction(connection, batchTx, [keypair], {
            commitment: 'confirmed',
          });
          accountsClosedCount += batch.length;
        }
      }
    }

    const rentReclaimedEst = accountsClosedCount * 0.00203928;

    // 2. SWEEP NATIVE SOL SETELAH TOKEN SELESAI DITUTUP
    let nativeSolTransferred = 0;
    if (options.sweepNativeSol) {
      const currentBalanceLamports = await connection.getBalance(keypair.publicKey);
      const txFeeLamports = 5000; // Minimal protocol fee 5,000 lamports (0.000005 SOL)

      if (currentBalanceLamports > txFeeLamports) {
        const transferLamports = currentBalanceLamports - txFeeLamports;
        const nativeTx = new Transaction();

        const accountInfo = await connection.getAccountInfo(keypair.publicKey);

        if (!accountInfo || accountInfo.data.length === 0) {
          nativeTx.add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: destPubkey,
              lamports: transferLamports,
            })
          );
          nativeSolTransferred = transferLamports;
        } else {
          // Akun membawa data (Nonce Account / Program Account)
          if (accountInfo.owner.equals(SystemProgram.programId) && accountInfo.data.length === 80) {
            const authPubkey = new PublicKey(accountInfo.data.slice(8, 40));
            if (authPubkey.equals(keypair.publicKey)) {
              nativeTx.add(
                SystemProgram.nonceWithdraw({
                  noncePubkey: keypair.publicKey,
                  authorizedPubkey: keypair.publicKey,
                  toPubkey: destPubkey,
                  lamports: transferLamports,
                })
              );
              nativeSolTransferred = transferLamports;
              logger.info('BURN', `[${walletSummary.walletLabel}] Menarik saldo dari Nonce Account via nonceWithdraw (${(transferLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL)...`);
            } else {
              logger.warn('BURN', `[${walletSummary.walletLabel}] ⚠️ Akun Nonce dikendalikan authority lain. Penarikan native SOL dilewati.`);
            }
          } else if (accountInfo.owner.equals(TOKEN_PROGRAM_ID) || accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
            nativeTx.add(
              createCloseAccountInstruction(
                keypair.publicKey,
                destPubkey,
                keypair.publicKey,
                [],
                accountInfo.owner
              )
            );
          } else {
            logger.warn('BURN', `[${walletSummary.walletLabel}] ⚠️ Akun membawa data program (${accountInfo.data.length} bytes). Transfer native SOL dilewati.`);
          }
        }

        if (nativeTx.instructions.length > 0) {
          logger.info('BURN', `[${walletSummary.walletLabel}] Mengirim saldo native SOL (${(transferLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL) ke backup...`);
          lastSignature = await sendAndConfirmTransaction(connection, nativeTx, [keypair], {
            commitment: 'confirmed',
          });
        }
      }
    }

    if (accountsClosedCount === 0 && nativeSolTransferred === 0) {
      logger.info('BURN', `[${walletSummary.walletLabel}] Dilewati: Tidak ada token atau saldo SOL yang dapat diproses.`);
      return {
        success: true,
        skipped: true,
        message: 'Dilewati (Tidak ada token atau saldo SOL yang dapat diproses)',
        reclaimedSol: 0,
      };
    }

    const totalReclaimed = rentReclaimedEst + (nativeSolTransferred / LAMPORTS_PER_SOL);
    logger.success('BURN', `[${walletSummary.walletLabel}] Berhasil! Ditutup ${accountsClosedCount} akun token, total transfer ~${totalReclaimed.toFixed(4)} SOL ke backup.`);

    return {
      success: true,
      signature: lastSignature,
      reclaimedSol: totalReclaimed,
    };
  } catch (err: any) {
    let errorMsg = err.message || 'Gagal mengirim transaksi Solana';

    if (err.logs && Array.isArray(err.logs)) {
      const logsStr = err.logs.join(' | ');
      if (logsStr.includes('Transfer: `from` must not carry data')) {
        errorMsg = 'Akun Solana memiliki data program/nonce (bukan system account biasa) sehingga saldo native SOL tidak dapat ditransfer langsung via System Transfer.';
      } else if (logsStr.includes('insufficient lamports')) {
        errorMsg = 'Saldo SOL tidak mencukupi untuk biaya transaksi gas Solana.';
      }
      logger.error('BURN', `[${walletSummary.walletLabel}] Detail Logs RPC: ${logsStr}`);
    }

    logger.error('BURN', `[${walletSummary.walletLabel}] Gagal: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      reclaimedSol: 0,
    };
  }
}

