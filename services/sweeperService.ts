import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import * as btc from '@scure/btc-signer';
import bs58 from 'bs58';
import { ParsedWalletItem, ChainType } from '../types/wallet';
import { SUPPORTED_CHAINS, ERC20_ABI } from '../config/chains';
import { getEffectiveRpcList, getEffectiveSolanaRpc } from './rpcConfig';
import { 
  getSolanaKeypairFromWallet, 
  scanSolanaTokenAccountsForBurn, 
  executeBurnAndSweepForWallet 
} from './solanaBurner';
import { logger } from './logger';

export const ERC20_SWEEPER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];


const bs58Decode = typeof bs58.decode === 'function' ? bs58.decode : ((bs58 as any).default && (bs58 as any).default.decode);

/**
 * Creates a resilient JsonRpcProvider with zero retry-hang and fast failover.
 * If an RPC is rate-limited (HTTP 429) or offline, it fails quickly instead of blocking for 20-30s.
 */
function createResilientEvmProvider(rpcUrl: string, chainIdNum?: number): ethers.JsonRpcProvider {
  const req = new ethers.FetchRequest(rpcUrl);
  req.retryFunc = async () => false; // Fail immediately on 429 or network errors so next RPC is tried seamlessly
  req.timeout = 7000; // 7s timeout per attempt
  return new ethers.JsonRpcProvider(req, chainIdNum, { staticNetwork: true });
}

// Network configuration for Litecoin in @scure/btc-signer
export const LTC_NETWORK = {
  bech32: 'ltc',
  pubKeyHash: 0x30, // Starts with L (P2PKH)
  scriptHash: 0x32, // Starts with M (P2SH)
  wif: 0xb0,
};

export interface DestinationAddresses {
  evm: string; // Used for ETH, BSC, Polygon, Base, Arbitrum, OP, AVAX, Linea, Blast, etc.
  solana?: string;
  tron?: string;
  litecoin?: string;
  bitcoin?: string;
}

export interface SweeperAssetItem {
  id: string; // unique asset item id
  walletId: string;
  walletLabel: string;
  walletType: 'mnemonic' | 'privateKey';
  fromAddress: string;
  chainId: string;
  chainName: string;
  chainType: ChainType;
  symbol: string;
  name: string;
  balance: string;
  rawBalance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  isNative: boolean;
  contractAddress?: string;
  needsBnbGasDispense?: boolean;
  needsTrxGasDispense?: boolean;
  selected: boolean;
  status: 'pending' | 'dispensing_gas' | 'processing' | 'success' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
  explorerUrl?: string;
}

export interface BnbDispenserPlan {
  funderWalletId?: string;
  funderWalletLabel?: string;
  funderAddress?: string;
  funderAvailableBnb: number;
  walletsNeedingGas: {
    walletId: string;
    walletLabel: string;
    address: string;
    tokenCount: number;
    tokensList: string;
    gasAmountBnb: number;
  }[];
  totalGasToDistributeBnb: number;
  canAutoFund: boolean;
}

export interface TronDispenserPlan {
  funderWalletId?: string;
  funderWalletLabel?: string;
  funderAddress?: string;
  funderAvailableTrx: number;
  walletsNeedingGas: {
    walletId: string;
    walletLabel: string;
    address: string;
    tokenCount: number;
    tokensList: string;
    gasAmountTrx: number;
  }[];
  totalGasToDistributeTrx: number;
  canAutoFund: boolean;
}

export interface SweeperSummary {
  eligibleWalletsCount: number;
  totalAssetsCount: number;
  totalValueUsd: number;
  assets: SweeperAssetItem[];
  bnbPlan: BnbDispenserPlan;
  tronPlan: TronDispenserPlan;
}

export interface ExecutionEventLog {
  timestamp: number;
  step: 'bnb_dispense' | 'trx_dispense' | 'token_transfer' | 'native_sweep';
  assetSymbol: string;
  chainName: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  valueUsd: number;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
  explorerUrl?: string;
}

/**
 * Extracts and accumulates all funded assets across eligible wallets.
 * Excludes watch-only addresses since they cannot sign transactions.
 */
export function extractSweeperAssets(wallets: ParsedWalletItem[]): SweeperSummary {
  const assets: SweeperAssetItem[] = [];
  const eligibleWallets = wallets.filter((w) => w.type !== 'address');

  // Track BSC BNB balances to determine if gas dispensation is needed for BEP-20 tokens
  const bscWalletBnbBalances: Record<string, number> = {};
  const bscWalletBep20Tokens: Record<string, SweeperAssetItem[]> = {};

  let highestBnbWallet: { id: string; label: string; address: string; balance: number } | null = null;

  for (const w of eligibleWallets) {
    for (const [chainId, chainAsset] of Object.entries(w.chainAssets || {})) {
      if (!chainAsset.hasBalance) continue;

      const chainConf = SUPPORTED_CHAINS.find((c) => c.id === chainId);
      const chainName = chainAsset.chainName || chainConf?.name || chainId;
      const chainType = chainAsset.chainType || chainConf?.type || 'evm';

      let fromAddr = '';
      if (chainType === 'evm') fromAddr = w.evmAddress || '';
      else if (chainType === 'solana') fromAddr = w.solanaAddress || '';
      else if (chainType === 'tron') fromAddr = w.tronAddress || '';
      else if (chainType === 'litecoin') fromAddr = w.ltcAddress || w.ltcLegacyAddress || '';
      else if (chainType === 'bitcoin') fromAddr = w.btcAddress || w.btcLegacyAddress || '';

      if (!fromAddr) continue;

      // 1. Native balance
      const nativeAmt = parseFloat(chainAsset.nativeBalance || '0');
      if (nativeAmt > 0) {
        if (chainId === 'bsc') {
          bscWalletBnbBalances[w.id] = nativeAmt;
          if (!highestBnbWallet || nativeAmt > highestBnbWallet.balance) {
            highestBnbWallet = { id: w.id, label: w.label, address: fromAddr, balance: nativeAmt };
          }
        }

        assets.push({
          id: `${w.id}_${chainId}_native`,
          walletId: w.id,
          walletLabel: w.label,
          walletType: w.type as 'mnemonic' | 'privateKey',
          fromAddress: fromAddr,
          chainId,
          chainName,
          chainType,
          symbol: chainAsset.chainShortName || chainConf?.nativeCurrency.symbol || 'NATIVE',
          name: chainConf?.nativeCurrency.name || `${chainName} Native`,
          balance: chainAsset.nativeBalance,
          rawBalance: (nativeAmt * 10 ** (chainConf?.nativeCurrency.decimals || 18)).toFixed(0),
          decimals: chainConf?.nativeCurrency.decimals || 18,
          priceUsd: chainAsset.nativePriceUsd || 0,
          valueUsd: chainAsset.nativeValueUsd || 0,
          isNative: true,
          selected: true,
          status: 'pending',
        });
      }

      // 2. Tokens
      for (const tok of chainAsset.tokens || []) {
        const tokAmt = parseFloat(tok.balance || '0');
        if (tokAmt > 0) {
          const assetItem: SweeperAssetItem = {
            id: `${w.id}_${chainId}_${tok.symbol}_${tok.contractAddress || 'tok'}`,
            walletId: w.id,
            walletLabel: w.label,
            walletType: w.type as 'mnemonic' | 'privateKey',
            fromAddress: fromAddr,
            chainId,
            chainName,
            chainType,
            symbol: tok.symbol,
            name: tok.name,
            balance: tok.balance,
            rawBalance: tok.rawBalance || (tokAmt * 10 ** tok.decimals).toFixed(0),
            decimals: tok.decimals,
            priceUsd: tok.priceUsd || 0,
            valueUsd: tok.valueUsd || 0,
            isNative: false,
            contractAddress: tok.contractAddress,
            selected: true,
            status: 'pending',
          };

          assets.push(assetItem);

          if (chainId === 'bsc') {
            if (!bscWalletBep20Tokens[w.id]) bscWalletBep20Tokens[w.id] = [];
            bscWalletBep20Tokens[w.id].push(assetItem);
          }
        }
      }
    }
  }

  // Determine BNB & TRON Gas Dispenser Plans dynamically
  const bnbPlan = calculateBnbDispenserPlan(assets, eligibleWallets);
  const tronPlan = calculateTronDispenserPlan(assets, eligibleWallets);

  // Mark tokens as needing gas dispense based on plan
  const gasNeedingWalletIds = new Set(bnbPlan.walletsNeedingGas.map((w) => w.walletId));
  for (const a of assets) {
    if (a.chainId === 'bsc' && !a.isNative && gasNeedingWalletIds.has(a.walletId)) {
      a.needsBnbGasDispense = true;
    }
  }

  const tronGasNeedingWalletIds = new Set(tronPlan.walletsNeedingGas.map((w) => w.walletId));
  for (const a of assets) {
    if (a.chainType === 'tron' && !a.isNative && tronGasNeedingWalletIds.has(a.walletId)) {
      a.needsTrxGasDispense = true;
    }
  }

  const totalValueUsd = assets.reduce((sum, a) => sum + (a.valueUsd || 0), 0);

  return {
    eligibleWalletsCount: eligibleWallets.length,
    totalAssetsCount: assets.length,
    totalValueUsd,
    assets,
    bnbPlan,
    tronPlan,
  };
}

/**
 * Calculates BNB Dispenser Plan based specifically on currently selected assets.
 * Only wallets with selected BEP-20 tokens that lack BNB gas will receive fee allocation.
 */
export function calculateBnbDispenserPlan(
  selectedAssets: SweeperAssetItem[],
  allWallets: ParsedWalletItem[]
): BnbDispenserPlan {
  const eligibleWallets = allWallets.filter((w) => w.type !== 'address');
  const bscWalletBnbBalances: Record<string, number> = {};
  const bscWalletBep20Tokens: Record<string, SweeperAssetItem[]> = {};

  let highestBnbWallet: { id: string; label: string; address: string; balance: number } | null = null;

  for (const w of eligibleWallets) {
    const bscAsset = w.chainAssets?.['bsc'];
    const nativeAmt = bscAsset ? parseFloat(bscAsset.nativeBalance || '0') : 0;
    if (nativeAmt > 0) {
      bscWalletBnbBalances[w.id] = nativeAmt;
      if (!highestBnbWallet || nativeAmt > highestBnbWallet.balance) {
        highestBnbWallet = { id: w.id, label: w.label, address: w.evmAddress || '', balance: nativeAmt };
      }
    }
  }

  // Only consider tokens that are actually selected for transfer on BSC!
  for (const asset of selectedAssets) {
    if (asset.selected && asset.chainId === 'bsc' && !asset.isNative) {
      if (!bscWalletBep20Tokens[asset.walletId]) {
        bscWalletBep20Tokens[asset.walletId] = [];
      }
      bscWalletBep20Tokens[asset.walletId].push(asset);
    }
  }

  const walletsNeedingGas: BnbDispenserPlan['walletsNeedingGas'] = [];
  // Ultra-minimal gas: ~55,000 gas at 1.05 gwei on BSC = ~0.000057 BNB (~$0.03) per BEP20 transfer
  const GAS_PER_TOKEN_BNB = 0.00006;

  for (const [walletId, tokens] of Object.entries(bscWalletBep20Tokens)) {
    const currentBnb = bscWalletBnbBalances[walletId] || 0;
    // Only dispense if wallet has less than 0.000055 BNB
    if (currentBnb < 0.000055) {
      const targetWallet = eligibleWallets.find((w) => w.id === walletId);
      if (targetWallet) {
        const neededGasBnb = Math.min(0.0003, Math.max(0.00006, tokens.length * GAS_PER_TOKEN_BNB));
        walletsNeedingGas.push({
          walletId,
          walletLabel: targetWallet.label,
          address: targetWallet.evmAddress || '',
          tokenCount: tokens.length,
          tokensList: tokens.map((t) => t.symbol).join(', '),
          gasAmountBnb: neededGasBnb,
        });
      }
    }
  }

  const totalGasToDistributeBnb = walletsNeedingGas.reduce((sum, w) => sum + w.gasAmountBnb, 0);
  const canAutoFund = highestBnbWallet !== null && highestBnbWallet.balance > totalGasToDistributeBnb + 0.0005;

  return {
    funderWalletId: highestBnbWallet?.id,
    funderWalletLabel: highestBnbWallet?.label,
    funderAddress: highestBnbWallet?.address,
    funderAvailableBnb: highestBnbWallet?.balance || 0,
    walletsNeedingGas,
    totalGasToDistributeBnb,
    canAutoFund,
  };
}

/**
 * Calculates TRON Gas Dispenser Plan based specifically on currently selected TRC-20 assets.
 * Allocates ~14 TRX per wallet that holds TRC-20 tokens but lacks energy gas.
 */
export function calculateTronDispenserPlan(
  selectedAssets: SweeperAssetItem[],
  allWallets: ParsedWalletItem[]
): TronDispenserPlan {
  const eligibleWallets = allWallets.filter((w) => w.type !== 'address');
  const tronWalletTrxBalances: Record<string, number> = {};
  const tronWalletTrc20Tokens: Record<string, SweeperAssetItem[]> = {};

  let highestTronWallet: { id: string; label: string; address: string; balance: number } | null = null;

  for (const w of eligibleWallets) {
    const tronAsset = w.chainAssets?.['tron-mainnet'] || w.chainAssets?.['tron'];
    const nativeAmt = tronAsset ? parseFloat(tronAsset.nativeBalance || '0') : 0;
    if (nativeAmt > 0) {
      tronWalletTrxBalances[w.id] = nativeAmt;
      if (!highestTronWallet || nativeAmt > highestTronWallet.balance) {
        highestTronWallet = { id: w.id, label: w.label, address: w.tronAddress || '', balance: nativeAmt };
      }
    }
  }

  // Find TRC-20 tokens selected for transfer
  for (const asset of selectedAssets) {
    if (asset.selected && asset.chainType === 'tron' && !asset.isNative) {
      if (!tronWalletTrc20Tokens[asset.walletId]) {
        tronWalletTrc20Tokens[asset.walletId] = [];
      }
      tronWalletTrc20Tokens[asset.walletId].push(asset);
    }
  }

  const walletsNeedingGas: TronDispenserPlan['walletsNeedingGas'] = [];
  const GAS_PER_TRC20_TRX = 14;

  for (const [walletId, tokens] of Object.entries(tronWalletTrc20Tokens)) {
    const currentTrx = tronWalletTrxBalances[walletId] || 0;
    if (currentTrx < 13.5) {
      const targetWallet = eligibleWallets.find((w) => w.id === walletId);
      if (targetWallet) {
        const neededTrx = Math.max(14, Math.ceil(tokens.length * GAS_PER_TRC20_TRX - currentTrx));
        walletsNeedingGas.push({
          walletId,
          walletLabel: targetWallet.label,
          address: targetWallet.tronAddress || '',
          tokenCount: tokens.length,
          tokensList: tokens.map((t) => t.symbol).join(', '),
          gasAmountTrx: neededTrx,
        });
      }
    }
  }

  const totalGasToDistributeTrx = walletsNeedingGas.reduce((sum, w) => sum + w.gasAmountTrx, 0);
  const canAutoFund = highestTronWallet !== null && highestTronWallet.balance > totalGasToDistributeTrx + 1.5;

  return {
    funderWalletId: highestTronWallet?.id,
    funderWalletLabel: highestTronWallet?.label,
    funderAddress: highestTronWallet?.address,
    funderAvailableTrx: highestTronWallet?.balance || 0,
    walletsNeedingGas,
    totalGasToDistributeTrx,
    canAutoFund,
  };
}

/**
 * Gets the private key for signing transactions on a specific blockchain.
 */
export function getPrivateKeyForChain(
  wallet: ParsedWalletItem,
  chainType: ChainType
): { hexOrBase58Key: string; keypair?: any } | null {
  try {
    if (wallet.type === 'mnemonic') {
      const account0 = wallet.derivedAccounts?.[0];
      if (chainType === 'evm') {
        if (account0?.evmPrivateKey) return { hexOrBase58Key: account0.evmPrivateKey };
      } else if (chainType === 'solana') {
        const kp = getSolanaKeypairFromWallet(wallet);
        if (kp) return { hexOrBase58Key: bs58.encode(kp.secretKey), keypair: kp };
      } else if (chainType === 'tron') {
        if (account0?.tronPrivateKey || account0?.evmPrivateKey) {
          return { hexOrBase58Key: (account0.tronPrivateKey || account0.evmPrivateKey)! };
        }
      } else if (chainType === 'litecoin') {
        if (account0?.ltcPrivateKey) return { hexOrBase58Key: account0.ltcPrivateKey };
      } else if (chainType === 'bitcoin') {
        if (account0?.btcPrivateKey) return { hexOrBase58Key: account0.btcPrivateKey };
      }
    } else if (wallet.type === 'privateKey') {
      const cleanSecret = wallet.rawSecret.trim();
      if (chainType === 'evm' || chainType === 'tron' || chainType === 'bitcoin' || chainType === 'litecoin') {
        const formatted = cleanSecret.startsWith('0x') ? cleanSecret : '0x' + cleanSecret;
        if (/^0x[0-9a-fA-F]{64}$/.test(formatted)) {
          return { hexOrBase58Key: formatted };
        }
      } else if (chainType === 'solana') {
        const kp = getSolanaKeypairFromWallet(wallet);
        if (kp) return { hexOrBase58Key: bs58.encode(kp.secretKey), keypair: kp };
      }
    }
  } catch (err: any) {
    logger.error('SWEEPER', `Gagal mengambil kunci untuk ${wallet.label} (${chainType}): ${err.message}`);
  }
  return null;
}

/**
 * Executes EVM Token (ERC-20 / BEP-20) Transfer.
 */
export async function executeEvmTokenTransfer(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; explorerUrl?: string }> {
  const chainConf = SUPPORTED_CHAINS.find((c) => c.id === asset.chainId);
  if (!chainConf || !asset.contractAddress) {
    return { success: false, error: 'Konfigurasi chain atau alamat kontrak tidak ditemukan' };
  }

  const keyInfo = getPrivateKeyForChain(wallet, 'evm');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia EVM tidak ditemukan' };
  }

  const rpcList = getEffectiveRpcList(chainConf);
  let lastError = '';

  for (const rpcUrl of rpcList) {
    try {
      const provider = createResilientEvmProvider(rpcUrl, chainConf.chainIdNum);
      const signer = new ethers.Wallet(keyInfo.hexOrBase58Key, provider);

      const contract = new ethers.Contract(asset.contractAddress, ERC20_SWEEPER_ABI, signer);

      // Verify live balance on-chain to prevent reverts and handle dust tokens safely
      let amountToTransfer: bigint;
      try {
        const liveBal: bigint = await contract.balanceOf(signer.address);
        amountToTransfer = liveBal;
      } catch {
        try {
          amountToTransfer = BigInt(asset.rawBalance || '0');
        } catch {
          amountToTransfer = 0n;
        }
      }

      if (amountToTransfer <= 0n) {
        return { success: false, error: 'Saldo token on-chain 0 atau sudah habis' };
      }

      logger.info(
        'SWEEPER',
        `[${asset.chainName}] Mengirim ${asset.balance} ${asset.symbol} dari ${wallet.label} ke ${destAddress.slice(0, 6)}...`
      );

      // Configure transaction overrides properly based on network type (EIP-1559 vs Legacy)
      const feeData = await provider.getFeeData();
      const txOverrides: any = {};

      if (asset.chainId === 'bsc') {
        // BSC is legacy (gasPrice only)
        txOverrides.gasPrice = ethers.parseUnits('1.05', 'gwei');
        txOverrides.type = 0;
      } else if (feeData.maxFeePerGas != null) {
        // EIP-1559 networks (Ethereum Mainnet, Arbitrum, Base, Polygon, etc.)
        // In EIP-1559, NEVER set gasPrice!
        txOverrides.maxFeePerGas = feeData.maxFeePerGas;
        txOverrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits('0.1', 'gwei');
        txOverrides.type = 2;
      } else if (feeData.gasPrice != null) {
        txOverrides.gasPrice = feeData.gasPrice;
        txOverrides.type = 0;
      }

      const tx = await contract.transfer(destAddress, amountToTransfer, txOverrides);
      const receipt = await tx.wait(1);

      const txHash = receipt.hash || tx.hash;
      const explorerUrl = `${chainConf.explorerUrl}/tx/${txHash}`;

      logger.success(
        'SWEEPER',
        `[${asset.chainName}] Berhasil transfer ${asset.balance} ${asset.symbol}! TX: ${txHash}`
      );

      return { success: true, txHash, explorerUrl };
    } catch (err: any) {
      let errMsg = err.message || 'Gagal transfer token EVM';
      const lower = errMsg.toLowerCase();
      if (
        lower.includes('insufficient funds') ||
        lower.includes('exceeds allowance') ||
        lower.includes('gas required')
      ) {
        errMsg = `Gas (${chainConf.nativeCurrency.symbol}) tidak mencukupi untuk biaya transfer token di ${wallet.label}`;
      }
      lastError = errMsg;
    }
  }

  return { success: false, error: lastError };
}

/**
 * Executes EVM Native Coin (ETH, BNB, MATIC, AVAX) Sweep.
 * Leaves 0 in source wallet (deducts exact gasLimit * gasPrice).
 */
export async function executeEvmNativeSweep(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; explorerUrl?: string }> {
  const chainConf = SUPPORTED_CHAINS.find((c) => c.id === asset.chainId);
  if (!chainConf) {
    return { success: false, error: 'Konfigurasi chain tidak ditemukan' };
  }

  const keyInfo = getPrivateKeyForChain(wallet, 'evm');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia EVM tidak ditemukan' };
  }

  const rpcList = getEffectiveRpcList(chainConf);
  let lastError = '';

  for (const rpcUrl of rpcList) {
    try {
      const provider = createResilientEvmProvider(rpcUrl, chainConf.chainIdNum);
      const signer = new ethers.Wallet(keyInfo.hexOrBase58Key, provider);

      const balance = await provider.getBalance(signer.address);
      const feeData = await provider.getFeeData();

      const gasLimit = 21000n;
      let gasPriceToDeduct: bigint;
      const txReq: any = {
        to: destAddress,
        gasLimit,
      };

      if (asset.chainId === 'bsc') {
        // BSC uses legacy gasPrice (1.05 gwei)
        const bscGas = ethers.parseUnits('1.05', 'gwei');
        gasPriceToDeduct = bscGas;
        txReq.gasPrice = bscGas;
        txReq.type = 0;
      } else if (feeData.maxFeePerGas != null) {
        // EIP-1559 (Ethereum Mainnet, Base, Arbitrum, Polygon, etc.)
        // IMPORTANT: In EIP-1559, NEVER specify gasPrice!
        gasPriceToDeduct = feeData.maxFeePerGas;
        txReq.maxFeePerGas = feeData.maxFeePerGas;
        txReq.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits('0.1', 'gwei');
        txReq.type = 2;
      } else {
        // Legacy chains
        const legGas = feeData.gasPrice || ethers.parseUnits('1.1', 'gwei');
        gasPriceToDeduct = legGas;
        txReq.gasPrice = legGas;
        txReq.type = 0;
      }

      const gasCost = gasPriceToDeduct * gasLimit;
      if (balance <= gasCost) {
        return {
          success: false,
          error: `Saldo tidak mencukupi untuk biaya gas minimal (~${ethers.formatEther(gasCost)} ${asset.symbol})`,
        };
      }

      const sweepAmount = balance - gasCost;
      txReq.value = sweepAmount;

      logger.info(
        'SWEEPER',
        `[${asset.chainName}] Mengirim ${ethers.formatEther(sweepAmount)} ${asset.symbol} dari ${wallet.label} ke ${destAddress.slice(0, 6)}...`
      );

      const tx = await signer.sendTransaction(txReq);

      const receipt = await tx.wait(1);
      const txHash = receipt.hash || tx.hash;
      const explorerUrl = `${chainConf.explorerUrl}/tx/${txHash}`;

      logger.success(
        'SWEEPER',
        `[${asset.chainName}] Berhasil sweep ${ethers.formatEther(sweepAmount)} ${asset.symbol}! TX: ${txHash}`
      );

      return { success: true, txHash, explorerUrl };
    } catch (err: any) {
      lastError = err.message || 'Gagal sweep koin native EVM';
    }
  }

  return { success: false, error: lastError };
}

/**
 * Executes Intelligent BNB Gas Dispense:
 * Sends micro-gas fee (~0.0004 BNB) from funder wallet to gas-starved wallet.
 */
export async function executeBnbGasDispense(
  funderWallet: ParsedWalletItem,
  recipientAddress: string,
  recipientLabel: string,
  gasAmountBnb: number = 0.00006
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const keyInfo = getPrivateKeyForChain(funderWallet, 'evm');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia funder BNB tidak ditemukan' };
  }

  const bscConf = SUPPORTED_CHAINS.find((c) => c.id === 'bsc');
  const rpcList = bscConf ? getEffectiveRpcList(bscConf) : ['https://bsc-dataseed1.defibit.io'];
  let lastError = '';

  for (const rpcUrl of rpcList) {
    try {
      const provider = createResilientEvmProvider(rpcUrl, bscConf?.chainIdNum || 56);
      const signer = new ethers.Wallet(keyInfo.hexOrBase58Key, provider);

      const valueToSend = ethers.parseEther(gasAmountBnb.toFixed(6));

      logger.info(
        'SWEEPER',
        `[BNB Dispenser] Mengirim ${gasAmountBnb} BNB gas fee dari ${funderWallet.label} ke ${recipientLabel} (${recipientAddress.slice(0, 6)}...)...`
      );

      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: valueToSend,
      });

      await tx.wait(1);

      logger.success(
        'SWEEPER',
        `[BNB Dispenser] Berhasil mendanai gas fee ke ${recipientLabel}! TX: ${tx.hash}`
      );

      return { success: true, txHash: tx.hash };
    } catch (err: any) {
      lastError = err.message || 'Gagal mendistribusikan BNB fee';
    }
  }

  return { success: false, error: lastError };
}

/**
 * Executes Solana Token (SPL) and Native SOL Sweep.
 */
export async function executeSolanaSweep(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; explorerUrl?: string }> {
  const keyInfo = getPrivateKeyForChain(wallet, 'solana');
  if (!keyInfo || !keyInfo.keypair) {
    return { success: false, error: 'Kunci rahasia Solana tidak ditemukan' };
  }

  const keypair = keyInfo.keypair;
  let destPubkey: PublicKey;
  try {
    destPubkey = new PublicKey(destAddress.trim());
  } catch {
    return { success: false, error: 'Alamat tujuan Solana tidak valid' };
  }

  const rpcUrl = getEffectiveSolanaRpc('mainnet');
  const connection = new Connection(rpcUrl, 'confirmed');

  try {
    if (asset.isNative) {
      // Sweep native SOL
      const balance = await connection.getBalance(keypair.publicKey);
      const txFee = 10000; // 0.00001 SOL
      if (balance <= txFee) {
        return { success: false, error: 'Saldo SOL tidak mencukupi untuk biaya gas Solana' };
      }

      const transferAmount = balance - txFee;
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: destPubkey,
          lamports: transferAmount,
        })
      );

      const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: 'confirmed',
      });

      const explorerUrl = `https://solscan.io/tx/${signature}`;
      logger.success('SWEEPER', `[Solana] Berhasil sweep ${(transferAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL! TX: ${signature}`);
      return { success: true, txHash: signature, explorerUrl };
    } else {
      // Transfer SPL Token
      const mintPubkey = new PublicKey(asset.contractAddress!);
      const fromAta = getAssociatedTokenAddressSync(mintPubkey, keypair.publicKey);
      const destAta = getAssociatedTokenAddressSync(mintPubkey, destPubkey);

      const tx = new Transaction();

      // Check if destination ATA exists, if not create it
      const destAtaInfo = await connection.getAccountInfo(destAta);
      if (!destAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            destAta,
            destPubkey,
            mintPubkey
          )
        );
      }

      tx.add(
        createTransferInstruction(
          fromAta,
          destAta,
          keypair.publicKey,
          BigInt(asset.rawBalance)
        )
      );

      const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: 'confirmed',
      });

      const explorerUrl = `https://solscan.io/tx/${signature}`;
      logger.success('SWEEPER', `[Solana] Berhasil transfer ${asset.balance} ${asset.symbol}! TX: ${signature}`);
      return { success: true, txHash: signature, explorerUrl };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal memproses transaksi Solana' };
  }
}

/**
 * Closes all SPL token accounts (reclaiming rent deposit ~0.00204 SOL per token directly to backup wallet)
 * and then sweeps 100% of the native SOL balance to the backup wallet.
 */
export async function executeSolanaBurnCloseAndSweep(
  wallet: ParsedWalletItem,
  destAddress: string,
  burnAndCloseTokens: boolean = true
): Promise<{ success: boolean; txHash?: string; error?: string; reclaimedSol?: number; accountsClosedCount?: number; explorerUrl?: string }> {
  const keyInfo = getPrivateKeyForChain(wallet, 'solana');
  if (!keyInfo || !keyInfo.keypair) {
    return { success: false, error: 'Kunci rahasia Solana tidak ditemukan' };
  }

  const rpcUrl = getEffectiveSolanaRpc('mainnet');
  const connection = new Connection(rpcUrl, 'confirmed');

  try {
    const { tokenAccounts, nativeSol } = await scanSolanaTokenAccountsForBurn(wallet.solanaAddress || '', connection);

    const burnSummary = {
      walletId: wallet.id,
      walletLabel: wallet.label,
      solanaAddress: wallet.solanaAddress || '',
      keypair: keyInfo.keypair,
      nativeSolBalance: nativeSol,
      tokenAccounts,
      totalReclaimableRentSol: tokenAccounts.length * 0.00203928,
      estimatedTotalSolToTransfer: nativeSol + (tokenAccounts.length * 0.00203928),
      status: 'ready' as const,
    };

    const res = await executeBurnAndSweepForWallet(
      burnSummary,
      destAddress,
      {
        burnAndCloseTokens,
        sweepNativeSol: true,
      },
      connection
    );

    if (res.success) {
      const explorerUrl = res.signature ? `https://solscan.io/tx/${res.signature}` : undefined;
      return {
        success: true,
        txHash: res.signature,
        reclaimedSol: res.reclaimedSol,
        accountsClosedCount: tokenAccounts.length,
        explorerUrl,
      };
    } else {
      return {
        success: false,
        error: res.error || 'Gagal memproses burn/close atau sweep Solana',
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengeksekusi burn & sweep Solana' };
  }
}

/**
 * Converts TRON Base58 address (T...) to 42-char Hex address (41...).
 */
function tronAddressToHex(tronBase58: string): string {
  if (tronBase58.startsWith('41') && tronBase58.length === 42) return tronBase58;
  const decoded = bs58Decode(tronBase58);
  return Buffer.from(decoded.slice(0, 21)).toString('hex');
}

export const TRON_FULLNODES = [
  'https://tron-rpc.publicnode.com',
  'https://trx.mytokenpocket.vip',
  'https://api.trongrid.io',
];

/**
 * Calls TRON fullnode API with automatic failover across resilient public nodes.
 * Completely eliminates the 3-RPS rate limit of TronGrid.
 */
export async function callTronRpc(path: string, body: any): Promise<any> {
  let lastErr: any = null;
  for (const node of TRON_FULLNODES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${node}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        // Skip rate-limited responses (e.g. Trongrid allowed_rps)
        if (json?.Error && typeof json.Error === 'string' && json.Error.includes('allowed_rps')) {
          continue;
        }
        return json;
      }
    } catch (err: any) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gagal menghubungi node RPC TRON');
}

/**
 * Checks if a TRON address is already activated on the TRON blockchain.
 */
export async function isTronAddressActive(address: string): Promise<boolean> {
  if (!address || !address.startsWith('T') || address.length !== 34) return false;
  try {
    const hex = tronAddressToHex(address);
    const data = await callTronRpc('/wallet/getaccount', { address: hex });
    return Boolean(data && data.address && !data.Error);
  } catch {
    return false;
  }
}

/**
 * Executes TRON TRX Native & TRC-20 Token (USDT) Transfer.
 */
export async function executeTronSweep(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ 
  success: boolean; 
  txHash?: string; 
  error?: string; 
  explorerUrl?: string; 
  isPermissionScam?: boolean; 
  isResourceInsufficient?: boolean; 
  isSkipped?: boolean; 
}> {
  const keyInfo = getPrivateKeyForChain(wallet, 'tron');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia TRON tidak ditemukan' };
  }

  let cleanPrivKey = keyInfo.hexOrBase58Key.replace(/^0x/, '');
  if (cleanPrivKey.length !== 64) {
    return { success: false, error: 'Format private key TRON tidak valid (harus 64 karakter hex)' };
  }

  try {
    const fromHex = tronAddressToHex(asset.fromAddress);
    const toHex = tronAddressToHex(destAddress);

    let txObj: any;

    // Check if destination address is already activated on TRON ledger
    const isDestActive = await isTronAddressActive(destAddress);

    if (asset.isNative) {
      // Query live on-chain balance in SUN directly from fullnode RPC
      let sunAmount = 0;
      try {
        const accJson = await callTronRpc('/wallet/getaccount', { address: fromHex });
        if (typeof accJson?.balance === 'number') {
          sunAmount = accJson.balance;
        }
      } catch {
        // fallback
      }

      if (sunAmount <= 0) {
        sunAmount = Math.floor(parseFloat(asset.balance) * 1_000_000);
      }

      if (sunAmount <= 0) {
        return { success: false, error: 'Saldo TRX on-chain 0 atau sudah kosong' };
      }

      let sweepSun = sunAmount;

      // Handle unactivated destination address
      if (!isDestActive) {
        // TRON consensus burns ~1.1 TRX to create a new address in state
        if (sunAmount < 1_150_000) {
          return {
            success: false,
            error: `Alamat tujuan TRON (${destAddress.slice(0, 8)}...) belum aktif di blockchain. Protokol TRON mewajibkan biaya aktivasi awal ~1.1 TRX yang dibakar oleh jaringan. Saldo wallet ini hanya ${(sunAmount / 1_000_000).toFixed(6)} TRX. Harap aktivasi alamat tujuan dengan mengisi 1.1 TRX atau prioritaskan wallet TRX dengan saldo >= 1.2 TRX terlebih dahulu.`,
          };
        }
        // Leave 1.1 TRX in sender wallet to be burned for destination account activation
        sweepSun = sunAmount - 1_100_000;
        if (sweepSun <= 0) {
          sweepSun = 10_000; // Transfer 0.01 TRX
        }
      } else {
        // Destination is already active: Check daily free bandwidth (600 bandwidth/day)
        let hasFreeBandwidth = true;
        try {
          const netJson = await callTronRpc('/wallet/getaccountnet', { address: fromHex });
          const freeLimit = netJson?.freeNetLimit ?? 600;
          const freeUsed = netJson?.freeNetUsed ?? 0;
          // Standard TRX transfer takes ~268 bytes / bandwidth
          hasFreeBandwidth = (freeLimit - freeUsed) >= 268;
        } catch {
          hasFreeBandwidth = true;
        }

        if (hasFreeBandwidth) {
          // 100% FREE OF CHARGE! 0 TRX fee burned!
          sweepSun = sunAmount;
        } else {
          // Free bandwidth exhausted: Deduct 270,000 SUN (~0.27 TRX) for burn fee
          const feeSun = 270_000;
          sweepSun = sunAmount - feeSun;
          if (sweepSun <= 0) {
            return {
              success: false,
              error: 'Bandwidth harian gratis TRON telah habis dan saldo tidak mencukupi untuk biaya burn jaringan (~0.27 TRX)',
            };
          }
        }
      }

      txObj = await callTronRpc('/wallet/createtransaction', {
        to_address: toHex,
        owner_address: fromHex,
        amount: sweepSun,
      });
    } else {
      // TRC-20 USDT transfer
      const contractHex = tronAddressToHex(asset.contractAddress || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
      const paramTo = toHex.slice(2).padStart(64, '0');
      const paramAmt = BigInt(asset.rawBalance).toString(16).padStart(64, '0');

      const trigData = await callTronRpc('/wallet/triggersmartcontract', {
        contract_address: contractHex,
        function_selector: 'transfer(address,uint256)',
        parameter: paramTo + paramAmt,
        fee_limit: 30_000_000,
        owner_address: fromHex,
      });

      if (!trigData?.result?.result && !trigData?.transaction) {
        return { success: false, error: trigData?.result?.message || 'Gagal memicu smart contract TRC20' };
      }
      txObj = trigData.transaction;
    }

    if (!txObj || !txObj.txID) {
      let errDetail = txObj?.Error || txObj?.message || txObj?.result?.message || 'Gagal membuat objek transaksi TRON dari API';
      if (typeof errDetail === 'string') {
        if (errDetail.includes('not contained of permission') || errDetail.includes('Validate signature error')) {
          return {
            success: false,
            error: `Wallet TRON menggunakan Multi-Sig / Izin dibajak (Scam Permission), otomatis dilewati (skipped)`,
            isPermissionScam: true,
            isSkipped: true,
          };
        }
        if (errDetail.includes('Account resource insufficient') || errDetail.includes('OUT_OF_ENERGY')) {
          return {
            success: false,
            error: `Saldo TRX tidak mencukupi untuk biaya Energy smart contract TRC-20 (Account resource insufficient error). Perlu ~14 TRX untuk gas fee.`,
            isResourceInsufficient: true,
          };
        }
        if (errDetail.includes('balance is not sufficient')) {
          if (!isDestActive) {
            errDetail = `Alamat TRON tujuan belum aktif di blockchain (perlu aktivasi awal ~1.1 TRX). Saldo wallet ini tidak mencukupi untuk biaya aktivasi.`;
          } else {
            errDetail = 'Saldo TRX di blockchain tidak mencukupi untuk jumlah transfer';
          }
        } else if (errDetail.includes('Cannot transfer TRX to yourself')) {
          errDetail = 'Alamat tujuan TRON sama dengan alamat sumber';
        }
      }
      return { success: false, error: errDetail };
    }

    // Sign the TRON transaction with ethers SigningKey
    const signingKey = new ethers.SigningKey('0x' + cleanPrivKey);
    const signature = signingKey.sign(ethers.getBytes('0x' + txObj.txID));
    const v = signature.v < 27 ? signature.v + 27 : signature.v;
    const sigHex = signature.r.slice(2) + signature.s.slice(2) + v.toString(16).padStart(2, '0');

    // Broadcast
    const bcastData = await callTronRpc('/wallet/broadcasttransaction', {
      ...txObj,
      signature: [sigHex],
    });

    if (bcastData?.result) {
      const txHash = txObj.txID;
      const explorerUrl = `https://tronscan.org/#/transaction/${txHash}`;
      logger.success('SWEEPER', `[TRON] Berhasil transfer ${asset.balance} ${asset.symbol}! TX: ${txHash}`);
      return { success: true, txHash, explorerUrl };
    } else {
      let bcastErr = 'Ditolak node TRON';
      if (bcastData?.message) {
        try {
          const decoded = Buffer.from(bcastData.message, 'hex').toString('utf8');
          bcastErr = /^[ -~]+$/.test(decoded) ? decoded : bcastData.message;
        } catch {
          bcastErr = bcastData.message;
        }
      }

      // 1. Detect Multi-Sig / Permission Scam (threshold multi-confirm or hijacked permission)
      const isPermissionScam =
        bcastErr.includes('not contained of permission') ||
        bcastErr.includes('Validate signature error') ||
        (bcastErr.includes('permission') && bcastErr.includes('sign')) ||
        bcastData?.code === 'SIGERROR';

      if (isPermissionScam) {
        logger.warn('SWEEPER', `[TRON] Terdeteksi izin wallet dibajak / Multi-Sig (${asset.fromAddress.slice(0, 8)}...): ${bcastErr}`);
        return {
          success: false,
          error: `Wallet TRON menggunakan Multi-Sig / Izin dibajak (Scam Permission), otomatis dilewati (skipped)`,
          isPermissionScam: true,
          isSkipped: true,
        };
      }

      // 2. Detect Account Resource Insufficient (Energy / TRX Gas for TRC-20)
      const isResourceInsufficient =
        bcastErr.includes('Account resource insufficient') ||
        bcastErr.includes('OUT_OF_ENERGY') ||
        bcastErr.includes('balance is not sufficient');

      if (isResourceInsufficient) {
        logger.warn('SWEEPER', `[TRON] Saldo TRX tidak cukup untuk Energy transfer TRC-20 pada ${asset.fromAddress.slice(0, 8)}...`);
        return {
          success: false,
          error: `Saldo TRX tidak mencukupi untuk biaya Energy smart contract TRC-20 (Account resource insufficient error). Perlu ~14 TRX untuk gas fee.`,
          isResourceInsufficient: true,
        };
      }

      return { success: false, error: bcastErr };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengeksekusi transfer TRON' };
  }
}

/**
 * Executes Intelligent TRON Gas Dispense:
 * Sends micro-gas fee (~14 TRX) from funder wallet to gas-starved wallet for TRC-20 smart contract execution.
 */
export async function executeTronGasDispense(
  funderWallet: ParsedWalletItem,
  recipientAddress: string,
  recipientLabel: string,
  gasAmountTrx: number = 14
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const keyInfo = getPrivateKeyForChain(funderWallet, 'tron');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia funder TRON tidak ditemukan' };
  }

  let cleanPrivKey = keyInfo.hexOrBase58Key.replace(/^0x/, '');
  if (cleanPrivKey.length !== 64) {
    return { success: false, error: 'Format private key funder TRON tidak valid (harus 64 karakter hex)' };
  }

  try {
    const fromHex = tronAddressToHex(funderWallet.tronAddress || '');
    const toHex = tronAddressToHex(recipientAddress);
    const sunToSend = Math.floor(gasAmountTrx * 1_000_000);

    logger.info(
      'SWEEPER',
      `[TRX Dispenser] Mengirim ${gasAmountTrx} TRX gas fee dari ${funderWallet.label} ke ${recipientLabel} (${recipientAddress.slice(0, 6)}...)...`
    );

    const txObj = await callTronRpc('/wallet/createtransaction', {
      to_address: toHex,
      owner_address: fromHex,
      amount: sunToSend,
    });

    if (!txObj || !txObj.txID) {
      return { success: false, error: txObj?.Error || 'Gagal membuat transaksi dispenser TRX' };
    }

    const signingKey = new ethers.SigningKey('0x' + cleanPrivKey);
    const signature = signingKey.sign(ethers.getBytes('0x' + txObj.txID));
    const v = signature.v < 27 ? signature.v + 27 : signature.v;
    const sigHex = signature.r.slice(2) + signature.s.slice(2) + v.toString(16).padStart(2, '0');

    const bcastData = await callTronRpc('/wallet/broadcasttransaction', {
      ...txObj,
      signature: [sigHex],
    });

    if (bcastData?.result) {
      const txHash = txObj.txID;
      logger.success('SWEEPER', `[TRX Dispenser] Berhasil mendanai ${gasAmountTrx} TRX ke ${recipientLabel}! TX: ${txHash}`);
      return { success: true, txHash };
    } else {
      let bcastErr = 'Ditolak node TRON saat mendanai gas TRX';
      if (bcastData?.message) {
        try {
          const decoded = Buffer.from(bcastData.message, 'hex').toString('utf8');
          bcastErr = /^[ -~]+$/.test(decoded) ? decoded : bcastData.message;
        } catch {
          bcastErr = bcastData.message;
        }
      }
      return { success: false, error: bcastErr };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mendanai TRX gas fee' };
  }
}

/**
 * Executes Litecoin (LTC) Sweep.
 */
export async function executeLitecoinSweep(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; explorerUrl?: string }> {
  const keyInfo = getPrivateKeyForChain(wallet, 'litecoin');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia Litecoin tidak ditemukan' };
  }

  try {
    const privKeyBytes = ethers.getBytes(keyInfo.hexOrBase58Key.startsWith('0x') ? keyInfo.hexOrBase58Key : '0x' + keyInfo.hexOrBase58Key);
    const pubKeyBytes = ethers.getBytes(ethers.SigningKey.computePublicKey(privKeyBytes, true));

    // Determine SegWit vs Legacy
    const p2wpkhObj = btc.p2wpkh(pubKeyBytes, LTC_NETWORK);

    // Fetch UTXOs from LitecoinSpace API
    const utxoRes = await fetch(`https://litecoinspace.org/api/address/${asset.fromAddress}/utxo`);
    if (!utxoRes.ok) {
      return { success: false, error: `Gagal mengambil UTXO Litecoin: HTTP ${utxoRes.status}` };
    }

    const utxos: { txid: string; vout: number; value: number }[] = await utxoRes.json();
    if (!utxos || utxos.length === 0) {
      return { success: false, error: 'Tidak ada UTXO yang belum dibelanjakan (unspent) pada alamat ini' };
    }

    const tx = new btc.Transaction();
    let totalInSat = 0n;

    for (const u of utxos) {
      totalInSat += BigInt(u.value);
      if (asset.fromAddress.startsWith('ltc1')) {
        tx.addInput({
          txid: u.txid,
          index: u.vout,
          witnessUtxo: {
            script: p2wpkhObj.script,
            amount: BigInt(u.value),
          },
        });
      } else {
        tx.addInput({
          txid: u.txid,
          index: u.vout,
          witnessUtxo: {
            script: p2wpkhObj.script,
            amount: BigInt(u.value),
          },
        });
      }
    }

    // Ultra-low LTC fee rate: ~140 sats at 1 litoshi/vB (~$0.0001)
    const feeEstSat = BigInt(utxos.length * 68 + 72);
    if (totalInSat <= feeEstSat) {
      return { success: false, error: 'Saldo LTC terlalu kecil untuk menutup biaya transaksi miner minimal' };
    }

    const sweepAmountSat = totalInSat - feeEstSat;
    tx.addOutputAddress(destAddress, sweepAmountSat, LTC_NETWORK);

    tx.sign(privKeyBytes);
    tx.finalize();

    // Broadcast to LitecoinSpace
    const postRes = await fetch('https://litecoinspace.org/api/tx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: tx.hex,
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      return { success: false, error: errText || 'Gagal broadcast transaksi Litecoin' };
    }

    const txHash = await postRes.text();
    const explorerUrl = `https://litecoinspace.org/tx/${txHash}`;
    logger.success('SWEEPER', `[LTC] Berhasil sweep ${(Number(sweepAmountSat) / 1e8).toFixed(6)} LTC! TX: ${txHash}`);

    return { success: true, txHash, explorerUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal sweep Litecoin' };
  }
}

/**
 * Executes Bitcoin (BTC) Sweep.
 */
export async function executeBitcoinSweep(
  asset: SweeperAssetItem,
  wallet: ParsedWalletItem,
  destAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; explorerUrl?: string }> {
  const keyInfo = getPrivateKeyForChain(wallet, 'bitcoin');
  if (!keyInfo) {
    return { success: false, error: 'Kunci rahasia Bitcoin tidak ditemukan' };
  }

  try {
    const privKeyBytes = ethers.getBytes(keyInfo.hexOrBase58Key.startsWith('0x') ? keyInfo.hexOrBase58Key : '0x' + keyInfo.hexOrBase58Key);
    const pubKeyBytes = ethers.getBytes(ethers.SigningKey.computePublicKey(privKeyBytes, true));

    const p2wpkhObj = btc.p2wpkh(pubKeyBytes, btc.NETWORK);

    // Fetch UTXOs from Mempool
    const utxoRes = await fetch(`https://mempool.space/api/address/${asset.fromAddress}/utxo`);
    if (!utxoRes.ok) {
      return { success: false, error: `Gagal mengambil UTXO Bitcoin: HTTP ${utxoRes.status}` };
    }

    const utxos: { txid: string; vout: number; value: number }[] = await utxoRes.json();
    if (!utxos || utxos.length === 0) {
      return { success: false, error: 'Tidak ada UTXO yang belum dibelanjakan pada alamat Bitcoin ini' };
    }

    const tx = new btc.Transaction();
    let totalInSat = 0n;

    for (const u of utxos) {
      totalInSat += BigInt(u.value);
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: {
          script: p2wpkhObj.script,
          amount: BigInt(u.value),
        },
      });
    }

    // Ultra-low BTC fee rate: ~140-180 sats at 1 sat/vB
    const feeEstSat = BigInt(utxos.length * 68 + 72);
    if (totalInSat <= feeEstSat) {
      return { success: false, error: 'Saldo BTC terlalu kecil untuk menutup biaya miner minimal' };
    }

    const sweepAmountSat = totalInSat - feeEstSat;
    tx.addOutputAddress(destAddress, sweepAmountSat, btc.NETWORK);

    tx.sign(privKeyBytes);
    tx.finalize();

    // Broadcast to Mempool API
    const postRes = await fetch('https://mempool.space/api/tx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: tx.hex,
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      return { success: false, error: errText || 'Gagal broadcast transaksi Bitcoin' };
    }

    const txHash = await postRes.text();
    const explorerUrl = `https://mempool.space/tx/${txHash}`;
    logger.success('SWEEPER', `[BTC] Berhasil sweep ${(Number(sweepAmountSat) / 1e8).toFixed(6)} BTC! TX: ${txHash}`);

    return { success: true, txHash, explorerUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal sweep Bitcoin' };
  }
}

