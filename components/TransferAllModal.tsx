import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Coins,
  Flame,
  Layers,
  ExternalLink,
  Key,
  Check,
  Copy,
  Sparkles,
  Wallet,
  Zap,
  CheckSquare,
  Square,
  Search,
  Filter,
  ArrowUpRight,
  Info,
  ChevronRight
} from 'lucide-react';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { ParsedWalletItem } from '../types/wallet';
import { SUPPORTED_CHAINS } from '../config/chains';
import { deriveAccountsFromMnemonic } from '../services/derivation';
import {
  extractSweeperAssets,
  calculateBnbDispenserPlan,
  calculateTronDispenserPlan,
  executeEvmTokenTransfer,
  executeEvmNativeSweep,
  executeBnbGasDispense,
  executeTronGasDispense,
  executeSolanaSweep,
  executeSolanaBurnCloseAndSweep,
  executeTronSweep,
  isTronAddressActive,
  executeLitecoinSweep,
  executeBitcoinSweep,
  SweeperAssetItem,
  BnbDispenserPlan,
  TronDispenserPlan,
  DestinationAddresses,
  ExecutionEventLog,
} from '../services/sweeperService';
import { logger } from '../services/logger';

interface TransferAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ParsedWalletItem[];
  selectedSubsetIds?: Set<string>;
  initialChainId?: string;
  onSuccessRefresh?: () => void;
}

export const TransferAllModal: React.FC<TransferAllModalProps> = ({
  isOpen,
  onClose,
  wallets,
  selectedSubsetIds,
  initialChainId,
  onSuccessRefresh,
}) => {
  // Step navigation: 1: Config, 2: Inventory & Review, 3: Execution
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Destination Addresses State
  const [destEvm, setDestEvm] = useState('');
  const [destSol, setDestSol] = useState('');
  const [destTron, setDestTron] = useState('');
  const [destLtc, setDestLtc] = useState('');
  const [destBtc, setDestBtc] = useState('');

  // Master Mnemonic auto-fill helper
  const [masterMnemonicInput, setMasterMnemonicInput] = useState('');
  const [mnemonicError, setMnemonicError] = useState('');
  const [mnemonicSuccess, setMnemonicSuccess] = useState(false);
  const [showMnemonicHelper, setShowMnemonicHelper] = useState(false);

  // Validation States
  const [evmError, setEvmError] = useState('');
  const [solError, setSolError] = useState('');
  const [tronError, setTronError] = useState('');
  const [ltcError, setLtcError] = useState('');
  const [btcError, setBtcError] = useState('');
  const [isDestTronActive, setIsDestTronActive] = useState<boolean | null>(null);

  // Assets and Gas Plans state
  const [sweeperAssets, setSweeperAssets] = useState<SweeperAssetItem[]>([]);
  const [autoDispenseBnb, setAutoDispenseBnb] = useState(true);
  const [autoDispenseTrx, setAutoDispenseTrx] = useState(true);
  const [solanaBurnAndCloseTokens, setSolanaBurnAndCloseTokens] = useState(true);

  // Asset Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState('all');
  const [selectedWalletFilter, setSelectedWalletFilter] = useState('all');

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPhase, setExecutionPhase] = useState<'idle' | 'dispense' | 'tokens' | 'natives' | 'done'>('idle');
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [totalOperations, setTotalOperations] = useState(0);
  const [executionLogs, setExecutionLogs] = useState<ExecutionEventLog[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Filter wallets based on selection if provided
  const targetWallets = useMemo(() => {
    if (selectedSubsetIds && selectedSubsetIds.size > 0) {
      return wallets.filter((w) => selectedSubsetIds.has(w.id));
    }
    return wallets;
  }, [wallets, selectedSubsetIds]);

  // Initial scan & extraction on open
  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      setExecutionLogs([]);
      setIsExecuting(false);
      setExecutionPhase('idle');
      setCurrentProgressIndex(0);

      const summary = extractSweeperAssets(targetWallets);
      const initialChain = initialChainId && initialChainId !== 'all' ? initialChainId : 'all';
      setSelectedChainFilter(initialChain);
      setSelectedWalletFilter('all');

      if (initialChain !== 'all') {
        // Pre-select ONLY assets matching initialChainId
        setSweeperAssets(
          summary.assets.map((a) => ({
            ...a,
            selected: a.chainId === initialChain,
          }))
        );
      } else {
        setSweeperAssets(summary.assets);
      }
    }
  }, [isOpen, targetWallets, initialChainId]);

  // Validate EVM address
  const handleEvmChange = (val: string) => {
    const clean = val.trim();
    setDestEvm(clean);
    if (!clean) {
      setEvmError('Alamat EVM tujuan wajib diisi');
    } else if (!ethers.isAddress(clean)) {
      setEvmError('Alamat EVM tidak valid (harus dimulai dengan 0x dan 40 karakter hex)');
    } else {
      setEvmError('');
    }
  };

  // Validate Solana address
  const handleSolChange = (val: string) => {
    const clean = val.trim();
    setDestSol(clean);
    if (!clean) {
      setSolError('');
      return;
    }
    try {
      const pk = new PublicKey(clean);
      if (!PublicKey.isOnCurve(pk.toBuffer())) {
        setSolError('Alamat Solana tidak berada di kurva ed25519 valid');
      } else {
        setSolError('');
      }
    } catch {
      setSolError('Format alamat Solana Base58 tidak valid');
    }
  };

  // Validate TRON address
  const handleTronChange = (val: string) => {
    const clean = val.trim();
    setDestTron(clean);
    if (!clean) {
      setTronError('');
      setIsDestTronActive(null);
      return;
    }
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) {
      setTronError('Alamat TRON harus diawali huruf "T" dan 34 karakter Base58');
      setIsDestTronActive(null);
    } else {
      setTronError('');
      isTronAddressActive(clean).then(setIsDestTronActive).catch(() => setIsDestTronActive(null));
    }
  };

  // Validate LTC address
  const handleLtcChange = (val: string) => {
    const clean = val.trim();
    setDestLtc(clean);
    if (!clean) {
      setLtcError('');
      return;
    }
    if (!/^(ltc1[a-zA-HJ-NP-Z0-9]{25,65}|[LM][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(clean)) {
      setLtcError('Alamat Litecoin tidak valid (harus diawali ltc1, L, atau M)');
    } else {
      setLtcError('');
    }
  };

  // Validate BTC address
  const handleBtcChange = (val: string) => {
    const clean = val.trim();
    setDestBtc(clean);
    if (!clean) {
      setBtcError('');
      return;
    }
    if (!/^(bc1[a-zA-HJ-NP-Z0-9]{25,65}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(clean)) {
      setBtcError('Alamat Bitcoin tidak valid (harus diawali bc1, 1, atau 3)');
    } else {
      setBtcError('');
    }
  };

  // Derive all addresses from Master Mnemonic
  const handleDeriveFromMnemonic = () => {
    const clean = masterMnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!clean) {
      setMnemonicError('Masukkan seed phrase 12-24 kata');
      return;
    }
    try {
      if (!ethers.Mnemonic.isValidMnemonic(clean)) {
        setMnemonicError('Mnemonic seed phrase tidak valid (periksa kembali kata-kata dan ejaan)');
        return;
      }
      const derived = deriveAccountsFromMnemonic(clean, 1);
      if (derived.evmPrimaryAddress) {
        setDestEvm(derived.evmPrimaryAddress);
        setEvmError('');
      }
      if (derived.solanaPrimaryAddress) {
        setDestSol(derived.solanaPrimaryAddress);
        setSolError('');
      }
      if (derived.tronPrimaryAddress) {
        setDestTron(derived.tronPrimaryAddress);
        setTronError('');
        isTronAddressActive(derived.tronPrimaryAddress).then(setIsDestTronActive).catch(() => setIsDestTronActive(null));
      }
      if (derived.ltcPrimaryAddress) {
        setDestLtc(derived.ltcPrimaryAddress);
        setLtcError('');
      }
      if (derived.btcPrimaryAddress) {
        setDestBtc(derived.btcPrimaryAddress);
        setBtcError('');
      }

      setMnemonicError('');
      setMnemonicSuccess(true);
      setShowMnemonicHelper(false);
      logger.success('SWEEPER', 'Alamat multi-chain tujuan berhasil diturunkan otomatis dari Master Mnemonic.');
    } catch (err: any) {
      setMnemonicError(err.message || 'Gagal menurunkan alamat dari mnemonic');
    }
  };

  // Paste from clipboard helper
  const handlePasteAddress = async (setter: (val: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      setter(text.trim());
    } catch {
      // ignore
    }
  };

  // Toggle selection for single asset
  const handleToggleAsset = (id: string) => {
    setSweeperAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  };

  // Toggle select/deselect all currently filtered assets
  const handleToggleSelectFiltered = (select: boolean) => {
    const filteredIds = new Set(filteredAssets.map((a) => a.id));
    setSweeperAssets((prev) =>
      prev.map((a) => (filteredIds.has(a.id) ? { ...a, selected: select } : a))
    );
  };

  // Select ONLY the currently filtered assets, deselect everything else!
  const handleSelectOnlyFiltered = () => {
    const filteredIds = new Set(filteredAssets.map((a) => a.id));
    setSweeperAssets((prev) =>
      prev.map((a) => ({ ...a, selected: filteredIds.has(a.id) }))
    );
  };

  // Select or deselect all assets across all chains & wallets
  const handleSelectAllGlobal = (select: boolean) => {
    setSweeperAssets((prev) => prev.map((a) => ({ ...a, selected: select })));
  };

  // Filter change handlers with automatic selection sync
  const handleChainFilterChange = (newChain: string) => {
    setSelectedChainFilter(newChain);
    if (newChain !== 'all') {
      setSweeperAssets((prev) =>
        prev.map((a) => {
          const matchChain = a.chainId === newChain;
          const matchWallet = selectedWalletFilter === 'all' || a.walletId === selectedWalletFilter;
          return { ...a, selected: matchChain && matchWallet };
        })
      );
    } else {
      setSweeperAssets((prev) =>
        prev.map((a) => ({
          ...a,
          selected: selectedWalletFilter === 'all' || a.walletId === selectedWalletFilter,
        }))
      );
    }
  };

  const handleWalletFilterChange = (newWalletId: string) => {
    setSelectedWalletFilter(newWalletId);
    if (newWalletId !== 'all') {
      setSweeperAssets((prev) =>
        prev.map((a) => {
          const matchWallet = a.walletId === newWalletId;
          const matchChain = selectedChainFilter === 'all' || a.chainId === selectedChainFilter;
          return { ...a, selected: matchWallet && matchChain };
        })
      );
    } else {
      setSweeperAssets((prev) =>
        prev.map((a) => ({
          ...a,
          selected: selectedChainFilter === 'all' || a.chainId === selectedChainFilter,
        }))
      );
    }
  };

  // Asset counts per chain for dropdown display
  const chainAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of sweeperAssets) {
      counts[a.chainId] = (counts[a.chainId] || 0) + 1;
    }
    return counts;
  }, [sweeperAssets]);

  // Asset counts per wallet for dropdown display
  const walletAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of sweeperAssets) {
      counts[a.walletId] = (counts[a.walletId] || 0) + 1;
    }
    return counts;
  }, [sweeperAssets]);

  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return sweeperAssets.filter((a) => {
      if (selectedChainFilter !== 'all' && a.chainId !== selectedChainFilter) return false;
      if (selectedWalletFilter !== 'all' && a.walletId !== selectedWalletFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.walletLabel.toLowerCase().includes(q) ||
          a.fromAddress.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sweeperAssets, selectedChainFilter, selectedWalletFilter, searchQuery]);

  // Calculations for selected assets
  const selectedAssets = useMemo(() => sweeperAssets.filter((a) => a.selected), [sweeperAssets]);
  const totalSelectedValueUsd = useMemo(
    () => selectedAssets.reduce((sum, a) => sum + (a.valueUsd || 0), 0),
    [selectedAssets]
  );

  // Dynamic Intelligent BNB dispenser plan calculated strictly on selectedAssets!
  const bnbPlan = useMemo(() => {
    return calculateBnbDispenserPlan(selectedAssets, targetWallets);
  }, [selectedAssets, targetWallets]);

  // Dynamic Intelligent TRON dispenser plan calculated strictly on selectedAssets!
  const tronPlan = useMemo(() => {
    return calculateTronDispenserPlan(selectedAssets, targetWallets);
  }, [selectedAssets, targetWallets]);

  // Check if any selected assets lack a destination address to guarantee 100% backup
  const missingDestinations = useMemo(() => {
    const missing: { chainType: string; label: string; count: number }[] = [];
    const evmCount = selectedAssets.filter((a) => a.chainType === 'evm').length;
    const solCount = selectedAssets.filter((a) => a.chainType === 'solana').length;
    const tronCount = selectedAssets.filter((a) => a.chainType === 'tron').length;
    const ltcCount = selectedAssets.filter((a) => a.chainType === 'litecoin').length;
    const btcCount = selectedAssets.filter((a) => a.chainType === 'bitcoin').length;

    if (evmCount > 0 && !destEvm.trim()) {
      missing.push({ chainType: 'evm', label: 'EVM (ETH, BSC, dll.)', count: evmCount });
    }
    if (solCount > 0 && !destSol.trim()) {
      missing.push({ chainType: 'solana', label: 'Solana (SOL & SPL)', count: solCount });
    }
    if (tronCount > 0 && !destTron.trim()) {
      missing.push({ chainType: 'tron', label: 'TRON (TRX & USDT)', count: tronCount });
    }
    if (ltcCount > 0 && !destLtc.trim()) {
      missing.push({ chainType: 'litecoin', label: 'Litecoin (LTC)', count: ltcCount });
    }
    if (btcCount > 0 && !destBtc.trim()) {
      missing.push({ chainType: 'bitcoin', label: 'Bitcoin (BTC)', count: btcCount });
    }
    return missing;
  }, [selectedAssets, destEvm, destSol, destTron, destLtc, destBtc]);

  const areAllFilteredSelected = filteredAssets.length > 0 && filteredAssets.every((a) => a.selected);

  // Check if destination addresses are populated for selected assets
  const hasSelectedEvm = selectedAssets.some((a) => a.chainType === 'evm');
  const hasSelectedSol = selectedAssets.some((a) => a.chainType === 'solana');
  const hasSelectedTron = selectedAssets.some((a) => a.chainType === 'tron');
  const hasSelectedLtc = selectedAssets.some((a) => a.chainType === 'litecoin');
  const hasSelectedBtc = selectedAssets.some((a) => a.chainType === 'bitcoin');

  const isConfigValid = useMemo(() => {
    if (selectedAssets.length === 0) return false;
    if (hasSelectedEvm && (!destEvm || !ethers.isAddress(destEvm))) return false;
    if (hasSelectedSol && destSol && solError) return false;
    if (hasSelectedTron && destTron && tronError) return false;
    if (hasSelectedLtc && destLtc && ltcError) return false;
    if (hasSelectedBtc && destBtc && btcError) return false;
    return true;
  }, [
    selectedAssets,
    hasSelectedEvm,
    destEvm,
    hasSelectedSol,
    destSol,
    solError,
    hasSelectedTron,
    destTron,
    tronError,
    hasSelectedLtc,
    destLtc,
    ltcError,
    hasSelectedBtc,
    destBtc,
    btcError,
  ]);

  // EXECUTION ORCHESTRATOR
  const handleStartSweep = async () => {
    if (!isConfigValid) return;

    setActiveStep(3);
    setIsExecuting(true);
    setExecutionLogs([]);

    const destinationMap: DestinationAddresses = {
      evm: destEvm,
      solana: destSol || undefined,
      tron: destTron || undefined,
      litecoin: destLtc || undefined,
      bitcoin: destBtc || undefined,
    };

    // Split assets: Tokens first, then Native coins
    const tokenAssets = selectedAssets.filter((a) => !a.isNative);
    const nativeAssets = selectedAssets.filter((a) => a.isNative);

    // Prioritize TRON native assets with highest balance first
    // If destination address is unactivated, the wallet with >= 1.2 TRX will activate it on-chain first
    const sortedNativeAssets = [...nativeAssets].sort((a, b) => {
      if (a.chainType === 'tron' && b.chainType === 'tron') {
        const balA = parseFloat(a.balance) || 0;
        const balB = parseFloat(b.balance) || 0;
        return balB - balA;
      }
      return 0;
    });

    // Calculate total operations
    const dispenseCountBnb = autoDispenseBnb && bnbPlan?.canAutoFund ? bnbPlan.walletsNeedingGas.length : 0;
    const dispenseCountTron = autoDispenseTrx && tronPlan?.canAutoFund ? tronPlan.walletsNeedingGas.length : 0;
    const totalOps = dispenseCountBnb + dispenseCountTron + tokenAssets.length + sortedNativeAssets.length;
    setTotalOperations(totalOps);
    let opIndex = 0;

    // Helper to log and update event
    const addLog = (log: ExecutionEventLog) => {
      setExecutionLogs((prev) => [log, ...prev]);
    };

    // =========================================================================
    // FASE 1: INTELLIGENT BNB GAS DISPENSE (Fee Saja untuk Token BEP-20)
    // =========================================================================
    if (dispenseCountBnb > 0 && bnbPlan?.funderWalletId) {
      setExecutionPhase('dispense');
      const funderWallet = targetWallets.find((w) => w.id === bnbPlan.funderWalletId);

      if (funderWallet) {
        logger.info(
          'SWEEPER',
          `[BNB Dispenser] Memulai distribusi gas fee (${dispenseCountBnb} wallet penerima) menggunakan saldo BNB dari ${funderWallet.label}...`
        );

        for (const recipient of bnbPlan.walletsNeedingGas) {
          opIndex++;
          setCurrentProgressIndex(opIndex);

          try {
            const dispenseResult = await executeBnbGasDispense(
              funderWallet,
              recipient.address,
              recipient.walletLabel,
              recipient.gasAmountBnb
            );

            if (dispenseResult.success) {
              addLog({
                timestamp: Date.now(),
                step: 'bnb_dispense',
                assetSymbol: 'BNB',
                chainName: 'BNB Smart Chain',
                fromAddress: funderWallet.evmAddress || '',
                toAddress: recipient.address,
                amount: `${recipient.gasAmountBnb} BNB`,
                valueUsd: recipient.gasAmountBnb * 600,
                status: 'success',
                txHash: dispenseResult.txHash,
                explorerUrl: `https://bscscan.com/tx/${dispenseResult.txHash}`,
              });
            } else {
              addLog({
                timestamp: Date.now(),
                step: 'bnb_dispense',
                assetSymbol: 'BNB',
                chainName: 'BNB Smart Chain',
                fromAddress: funderWallet.evmAddress || '',
                toAddress: recipient.address,
                amount: `${recipient.gasAmountBnb} BNB`,
                valueUsd: 0,
                status: 'failed',
                error: dispenseResult.error,
              });
            }
          } catch (err: any) {
            addLog({
              timestamp: Date.now(),
              step: 'bnb_dispense',
              assetSymbol: 'BNB',
              chainName: 'BNB Smart Chain',
              fromAddress: funderWallet.evmAddress || '',
              toAddress: recipient.address,
              amount: `${recipient.gasAmountBnb} BNB`,
              valueUsd: 0,
              status: 'failed',
              error: err.message,
            });
          }

          // Small cooldown between nonce transactions
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    // =========================================================================
    // FASE 1B: INTELLIGENT TRON TRX GAS DISPENSE (Fee Saja untuk Token TRC-20 USDT)
    // =========================================================================
    if (dispenseCountTron > 0 && tronPlan?.funderWalletId) {
      setExecutionPhase('dispense');
      const funderWallet = targetWallets.find((w) => w.id === tronPlan.funderWalletId);

      if (funderWallet) {
        logger.info(
          'SWEEPER',
          `[TRX Dispenser] Memulai distribusi TRX gas fee (${dispenseCountTron} wallet penerima) menggunakan saldo TRX dari ${funderWallet.label}...`
        );

        for (const recipient of tronPlan.walletsNeedingGas) {
          opIndex++;
          setCurrentProgressIndex(opIndex);

          try {
            const dispenseResult = await executeTronGasDispense(
              funderWallet,
              recipient.address,
              recipient.walletLabel,
              recipient.gasAmountTrx
            );

            if (dispenseResult.success) {
              addLog({
                timestamp: Date.now(),
                step: 'trx_dispense',
                assetSymbol: 'TRX',
                chainName: 'TRON Mainnet',
                fromAddress: funderWallet.tronAddress || '',
                toAddress: recipient.address,
                amount: `${recipient.gasAmountTrx} TRX`,
                valueUsd: recipient.gasAmountTrx * 0.33,
                status: 'success',
                txHash: dispenseResult.txHash,
                explorerUrl: `https://tronscan.org/#/transaction/${dispenseResult.txHash}`,
              });
            } else {
              addLog({
                timestamp: Date.now(),
                step: 'trx_dispense',
                assetSymbol: 'TRX',
                chainName: 'TRON Mainnet',
                fromAddress: funderWallet.tronAddress || '',
                toAddress: recipient.address,
                amount: `${recipient.gasAmountTrx} TRX`,
                valueUsd: 0,
                status: 'failed',
                error: dispenseResult.error,
              });
            }
          } catch (err: any) {
            addLog({
              timestamp: Date.now(),
              step: 'trx_dispense',
              assetSymbol: 'TRX',
              chainName: 'TRON Mainnet',
              fromAddress: funderWallet.tronAddress || '',
              toAddress: recipient.address,
              amount: `${recipient.gasAmountTrx} TRX`,
              valueUsd: 0,
              status: 'failed',
              error: err.message,
            });
          }

          // Wait 3 seconds for TRON block confirmation
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }

    // =========================================================================
    // FASE 2: TRANSFER SELURUH TOKEN (ERC-20, BEP-20, TRC-20, SPL)
    // =========================================================================
    setExecutionPhase('tokens');
    const processedSolanaWallets = new Set<string>();

    for (const asset of tokenAssets) {
      opIndex++;
      setCurrentProgressIndex(opIndex);

      const sourceWallet = targetWallets.find((w) => w.id === asset.walletId);
      if (!sourceWallet) continue;

      let destAddress = '';
      if (asset.chainType === 'evm') destAddress = destinationMap.evm;
      else if (asset.chainType === 'solana') destAddress = destinationMap.solana || '';
      else if (asset.chainType === 'tron') destAddress = destinationMap.tron || '';

      if (!destAddress) {
        addLog({
          timestamp: Date.now(),
          step: 'token_transfer',
          assetSymbol: asset.symbol,
          chainName: asset.chainName,
          fromAddress: asset.fromAddress,
          toAddress: 'N/A',
          amount: `${asset.balance} ${asset.symbol}`,
          valueUsd: asset.valueUsd,
          status: 'skipped',
          error: `Alamat tujuan untuk rantai ${asset.chainType} belum ditentukan`,
        });
        continue;
      }

      try {
        let result: { 
          success: boolean; 
          txHash?: string; 
          error?: string; 
          explorerUrl?: string; 
          reclaimedSol?: number;
          isPermissionScam?: boolean;
          isResourceInsufficient?: boolean;
          isSkipped?: boolean;
        } = {
          success: false,
        };

        if (asset.chainType === 'evm') {
          result = await executeEvmTokenTransfer(asset, sourceWallet, destAddress);
        } else if (asset.chainType === 'solana') {
          if (solanaBurnAndCloseTokens) {
            if (!processedSolanaWallets.has(asset.walletId)) {
              processedSolanaWallets.add(asset.walletId);
              // Otomatis burn & close seluruh akun token SPL di wallet ini & reclaim rent + sweep SOL ke destAddress
              result = await executeSolanaBurnCloseAndSweep(sourceWallet, destAddress, true);
              if (result.success) {
                addLog({
                  timestamp: Date.now(),
                  step: 'token_transfer',
                  assetSymbol: 'SOL / SPL',
                  chainName: 'Solana',
                  fromAddress: asset.fromAddress,
                  toAddress: destAddress,
                  amount: `Semua Token SPL Ditutup & Reclaim ~${result.reclaimedSol?.toFixed(4) || '0'} SOL ke Backup`,
                  valueUsd: asset.valueUsd,
                  status: 'success',
                  txHash: result.txHash,
                  explorerUrl: result.explorerUrl,
                });
                await new Promise((resolve) => setTimeout(resolve, 800));
                continue;
              }
            } else {
              // Sudah diproses bersamaan saat penutupan akun token wallet ini
              addLog({
                timestamp: Date.now(),
                step: 'token_transfer',
                assetSymbol: asset.symbol,
                chainName: 'Solana',
                fromAddress: asset.fromAddress,
                toAddress: destAddress,
                amount: `${asset.balance} ${asset.symbol} (Ditutup & Rent Reclaimed ke Backup)`,
                valueUsd: asset.valueUsd,
                status: 'success',
              });
              continue;
            }
          } else {
            result = await executeSolanaSweep(asset, sourceWallet, destAddress);
          }
        } else if (asset.chainType === 'tron') {
          result = await executeTronSweep(asset, sourceWallet, destAddress);

          // On-the-fly emergency rescue funding if account resource insufficient for TRC-20
          if (!result.success && result.isResourceInsufficient && autoDispenseTrx && tronPlan?.funderWalletId) {
            const funderWallet = targetWallets.find((w) => w.id === tronPlan.funderWalletId);
            if (funderWallet && funderWallet.id !== sourceWallet.id) {
              logger.warn('SWEEPER', `[TRON] Terdeteksi kekurangan energy untuk ${asset.symbol}. Mendanai darurat 14 TRX dari ${funderWallet.label}...`);
              const rescueRes = await executeTronGasDispense(funderWallet, asset.fromAddress, sourceWallet.label, 14);
              if (rescueRes.success) {
                addLog({
                  timestamp: Date.now(),
                  step: 'trx_dispense',
                  assetSymbol: 'TRX',
                  chainName: 'TRON Mainnet',
                  fromAddress: funderWallet.tronAddress || '',
                  toAddress: asset.fromAddress,
                  amount: '14 TRX',
                  valueUsd: 14 * 0.33,
                  status: 'success',
                  txHash: rescueRes.txHash,
                  explorerUrl: `https://tronscan.org/#/transaction/${rescueRes.txHash}`,
                });
                await new Promise((resolve) => setTimeout(resolve, 3500));
                // Retry TRC-20 transfer!
                result = await executeTronSweep(asset, sourceWallet, destAddress);
              }
            }
          }
        }

        if (result.success) {
          addLog({
            timestamp: Date.now(),
            step: 'token_transfer',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'success',
            txHash: result.txHash,
            explorerUrl: result.explorerUrl,
          });
        } else if (result.isPermissionScam || result.isSkipped) {
          // USER REQUEST: Jika tron wallet pake multi confirm / scam permission langsung SKIP!
          addLog({
            timestamp: Date.now(),
            step: 'token_transfer',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'skipped',
            error: result.error || 'Wallet TRON Multi-Sig / Izin dibajak dilewati',
          });
        } else {
          addLog({
            timestamp: Date.now(),
            step: 'token_transfer',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'failed',
            error: result.error,
          });
        }
      } catch (err: any) {
        addLog({
          timestamp: Date.now(),
          step: 'token_transfer',
          assetSymbol: asset.symbol,
          chainName: asset.chainName,
          fromAddress: asset.fromAddress,
          toAddress: destAddress,
          amount: `${asset.balance} ${asset.symbol}`,
          valueUsd: asset.valueUsd,
          status: 'failed',
          error: err.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // =========================================================================
    // FASE 3: SWEEP SELURUH KOIN NATIVE (ETH, BNB SISA, TRX, LTC, BTC, SOL)
    // =========================================================================
    setExecutionPhase('natives');
    for (const asset of sortedNativeAssets) {
      opIndex++;
      setCurrentProgressIndex(opIndex);

      const sourceWallet = targetWallets.find((w) => w.id === asset.walletId);
      if (!sourceWallet) continue;

      let destAddress = '';
      if (asset.chainType === 'evm') destAddress = destinationMap.evm;
      else if (asset.chainType === 'solana') destAddress = destinationMap.solana || '';
      else if (asset.chainType === 'tron') destAddress = destinationMap.tron || '';
      else if (asset.chainType === 'litecoin') destAddress = destinationMap.litecoin || '';
      else if (asset.chainType === 'bitcoin') destAddress = destinationMap.bitcoin || '';

      if (!destAddress) {
        addLog({
          timestamp: Date.now(),
          step: 'native_sweep',
          assetSymbol: asset.symbol,
          chainName: asset.chainName,
          fromAddress: asset.fromAddress,
          toAddress: 'N/A',
          amount: `${asset.balance} ${asset.symbol}`,
          valueUsd: asset.valueUsd,
          status: 'skipped',
          error: `Alamat tujuan untuk rantai ${asset.chainType} belum ditentukan`,
        });
        continue;
      }

      let sweepSuccess = false;
      try {
        let result: { 
          success: boolean; 
          txHash?: string; 
          error?: string; 
          explorerUrl?: string;
          isPermissionScam?: boolean;
          isResourceInsufficient?: boolean;
          isSkipped?: boolean;
        } = {
          success: false,
        };

        if (asset.chainType === 'evm') {
          result = await executeEvmNativeSweep(asset, sourceWallet, destAddress);
        } else if (asset.chainType === 'solana') {
          if (solanaBurnAndCloseTokens) {
            if (processedSolanaWallets.has(asset.walletId)) {
              // Saldo SOL sudah ter-sweep 100% bersamaan dengan penutupan token SPL
              sweepSuccess = true;
              addLog({
                timestamp: Date.now(),
                step: 'native_sweep',
                assetSymbol: 'SOL',
                chainName: 'Solana',
                fromAddress: asset.fromAddress,
                toAddress: destAddress,
                amount: `${asset.balance} SOL (Sudah Ter-sweep bersamaan Reclaim Rent)`,
                valueUsd: asset.valueUsd,
                status: 'success',
              });
              continue;
            } else {
              processedSolanaWallets.add(asset.walletId);
              result = await executeSolanaBurnCloseAndSweep(sourceWallet, destAddress, true);
            }
          } else {
            result = await executeSolanaSweep(asset, sourceWallet, destAddress);
          }
        } else if (asset.chainType === 'tron') {
          result = await executeTronSweep(asset, sourceWallet, destAddress);
        } else if (asset.chainType === 'litecoin') {
          result = await executeLitecoinSweep(asset, sourceWallet, destAddress);
        } else if (asset.chainType === 'bitcoin') {
          result = await executeBitcoinSweep(asset, sourceWallet, destAddress);
        }

        if (result.success) {
          sweepSuccess = true;
          addLog({
            timestamp: Date.now(),
            step: 'native_sweep',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'success',
            txHash: result.txHash,
            explorerUrl: result.explorerUrl,
          });
        } else if (result.isPermissionScam || result.isSkipped) {
          // USER REQUEST: Jika tron wallet pake multi confirm / scam permission langsung SKIP!
          addLog({
            timestamp: Date.now(),
            step: 'native_sweep',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'skipped',
            error: result.error || 'Wallet TRON Multi-Sig / Izin dibajak dilewati',
          });
        } else {
          addLog({
            timestamp: Date.now(),
            step: 'native_sweep',
            assetSymbol: asset.symbol,
            chainName: asset.chainName,
            fromAddress: asset.fromAddress,
            toAddress: destAddress,
            amount: `${asset.balance} ${asset.symbol}`,
            valueUsd: asset.valueUsd,
            status: 'failed',
            error: result.error,
          });
        }
      } catch (err: any) {
        addLog({
          timestamp: Date.now(),
          step: 'native_sweep',
          assetSymbol: asset.symbol,
          chainName: asset.chainName,
          fromAddress: asset.fromAddress,
          toAddress: destAddress,
          amount: `${asset.balance} ${asset.symbol}`,
          valueUsd: asset.valueUsd,
          status: 'failed',
          error: err.message,
        });
      }

      if (sweepSuccess && asset.chainType === 'tron' && (parseFloat(asset.balance) || 0) >= 1.15) {
        // Wait 3 seconds for TRON block confirmation so destination address is registered as active for subsequent transfers
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setExecutionPhase('done');
    setIsExecuting(false);
    onSuccessRefresh?.();
    logger.success('SWEEPER', 'Operasi Transfer All selesai! Semua transaksi telah disiarkan.');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const percentComplete = totalOperations > 0 ? Math.round((currentProgressIndex / totalOperations) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={isExecuting ? undefined : onClose}>
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0d121f 0%, #080c14 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.15)',
        }}
      >
        {/* MODAL HEADER */}
        <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="brand-icon"
              style={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Send size={20} color="#000" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Transfer All to One Wallet
                </span>
                <span className="brand-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  Multi-Chain Sweeper
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Akumulasi seluruh aset dan transfer ke satu wallet tujuan dengan Intelligent BNB Fee Dispenser
              </p>
            </div>
          </div>
          {!isExecuting && (
            <button className="copy-btn" onClick={onClose} title="Tutup Modal">
              <X size={20} />
            </button>
          )}
        </div>

        {/* STEP PROGRESS BAR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: activeStep > 1 && !isExecuting ? 'pointer' : 'default',
            }}
            onClick={() => !isExecuting && setActiveStep(1)}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: activeStep === 1 ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: activeStep === 1 ? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              1
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: activeStep === 1 ? 700 : 500, color: activeStep === 1 ? '#fff' : 'var(--text-muted)' }}>
              Alamat Tujuan & Fee BNB
            </span>
          </div>

          <ChevronRight size={16} color="var(--text-muted)" />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: activeStep > 2 && !isExecuting ? 'pointer' : 'default',
            }}
            onClick={() => !isExecuting && setActiveStep(2)}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: activeStep === 2 ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: activeStep === 2 ? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              2
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: activeStep === 2 ? 700 : 500, color: activeStep === 2 ? '#fff' : 'var(--text-muted)' }}>
              Daftar Aset ({selectedAssets.length})
            </span>
          </div>

          <ChevronRight size={16} color="var(--text-muted)" />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: activeStep === 3 ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: activeStep === 3 ? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              3
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: activeStep === 3 ? 700 : 500, color: activeStep === 3 ? '#fff' : 'var(--text-muted)' }}>
              Eksekusi & Live Progress
            </span>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* ========================================================================= */}
          {/* STEP 1: DESTINATION CONFIG & BNB GAS STRATEGY */}
          {/* ========================================================================= */}
          {activeStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* TOP VALUATION SUMMARY */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.12))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>TOTAL AKUMULASI SELURUH ASET</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                    ${totalSelectedValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>SUMBER PENGIRIMAN</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    {targetWallets.filter((w) => w.type !== 'address').length} Wallets ({selectedAssets.length} Aset)
                  </div>
                </div>
              </div>

              {/* SCOPE & FILTER BAR IN STEP 1 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>
                    <Filter size={16} />
                    <span>Filter Lingkup Transfer (Pilih Blockchain & Sumber Wallet)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#34d399' }}>{selectedAssets.length}</strong> dari {sweeperAssets.length} aset terpilih
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  {/* Chain Filter Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Target Blockchain:
                    </label>
                    <select
                      className="input-field"
                      value={selectedChainFilter}
                      onChange={(e) => handleChainFilterChange(e.target.value)}
                      style={{ fontSize: '0.82rem' }}
                    >
                      <option value="all">Semua Rantai (Multi-Chain: {sweeperAssets.length} Aset)</option>
                      {SUPPORTED_CHAINS.filter((c) => (chainAssetCounts[c.id] || 0) > 0).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({chainAssetCounts[c.id]} aset)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Wallet Filter Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Sumber Wallet:
                    </label>
                    <select
                      className="input-field"
                      value={selectedWalletFilter}
                      onChange={(e) => handleWalletFilterChange(e.target.value)}
                      style={{ fontSize: '0.82rem' }}
                    >
                      <option value="all">Semua Wallet ({targetWallets.length} Wallet)</option>
                      {targetWallets.filter((w) => (walletAssetCounts[w.id] || 0) > 0).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label} ({walletAssetCounts[w.id] || 0} aset)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(selectedChainFilter !== 'all' || selectedWalletFilter !== 'all') && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: 4 }}>
                    <span>
                      🎯 Filter Aktif: Menargetkan <strong>{selectedAssets.length} aset</strong> (${totalSelectedValueUsd.toFixed(2)} USD)
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        handleChainFilterChange('all');
                        handleWalletFilterChange('all');
                      }}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      Reset ke Semua
                    </button>
                  </div>
                )}
              </div>

              {/* ZERO PLATFORM FEE & ULTRA-MINIMAL GAS BADGE */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#34d399' }}>
                      0% Biaya Aplikasi (Gratis) — Mode Ultra-Hemat Gas Aktif
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Aplikasi ini tidak memungut komisi apa pun. Biaya gas blockchain ditekan ke batas terendah absolut node validator (1.05 Gwei di BSC, ~140 sats di LTC/BTC, bandwidth gratis di TRON).
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#34d399',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Min. Network Fee
                </span>
              </div>

              {/* INTELLIGENT BNB FEE DISPENSER NOTICE */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(243, 186, 47, 0.08)',
                  border: '1px solid rgba(243, 186, 47, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F3BA2F', fontWeight: 700, fontSize: '0.92rem' }}>
                    <Flame size={18} />
                    <span>Intelligent BNB Gas Dispenser & Fee Strategy (Ultra-Low Gas)</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoDispenseBnb}
                      onChange={(e) => setAutoDispenseBnb(e.target.checked)}
                    />
                    <span>Aktifkan Distribusi Fee BNB Otomatis</span>
                  </label>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>Sesuai instruksi Anda:</strong> Jika ditemukan BNB pada wallet, sistem akan mendistribusikan BNB
                  <strong> hanya untuk fee minimal saja</strong> ke wallet yang memiliki token BEP-20 namun kehabisan gas (~0.00006 BNB per token).
                  Semua token akan ditransfer terlebih dahulu, lalu <strong>seluruh sisa saldo BNB akan ditransfer 100%</strong> ke wallet tujuan tanpa tersisa.
                </p>

                {bnbPlan && bnbPlan.walletsNeedingGas.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
                      <span>⚠️ {bnbPlan.walletsNeedingGas.length} Wallet memiliki token BEP-20 tanpa saldo BNB gas</span>
                      <span>Total fee dibutuhkan: ~{bnbPlan.totalGasToDistributeBnb.toFixed(4)} BNB</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Funder Gas Terdeteksi: <strong style={{ color: '#fff' }}>{bnbPlan.funderWalletLabel || 'Tidak ada'}</strong> (Tersedia: {bnbPlan.funderAvailableBnb.toFixed(4)} BNB)
                    </div>
                  </div>
                )}
              </div>

              {/* INTELLIGENT TRON TRX FEE DISPENSER NOTICE */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 0, 19, 0.08)',
                  border: '1px solid rgba(255, 0, 19, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff4d4d', fontWeight: 700, fontSize: '0.92rem' }}>
                    <Flame size={18} />
                    <span>Intelligent TRON TRX Gas Dispenser (Auto-Fund Gas untuk USDT TRC-20)</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoDispenseTrx}
                      onChange={(e) => setAutoDispenseTrx(e.target.checked)}
                    />
                    <span>Aktifkan Auto-Fund Fee TRX</span>
                  </label>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>Sesuai instruksi Anda:</strong> Jika akun tidak memiliki cukup TRX untuk biaya Energy transfer USDT (~14 TRX),
                  sistem akan mendistribusikan TRX dari wallet utama/funder <strong>sesuai fee yang dibutuhkan saja</strong> agar token terkirim sukses.
                  Setelah seluruh token USDT terkirim, <strong>seluruh sisa TRX akan di-sweep ke wallet backup</strong> tanpa ada yang tertinggal.
                </p>

                {tronPlan && tronPlan.walletsNeedingGas.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff7875' }}>
                      <span>⚠️ {tronPlan.walletsNeedingGas.length} Wallet memiliki token TRC-20 tanpa saldo TRX gas yang cukup</span>
                      <span>Total fee dibutuhkan: ~{tronPlan.totalGasToDistributeTrx} TRX</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Funder Gas Terdeteksi: <strong style={{ color: '#fff' }}>{tronPlan.funderWalletLabel || 'Tidak ada'}</strong> (Tersedia: {tronPlan.funderAvailableTrx.toFixed(2)} TRX)
                    </div>
                  </div>
                )}
              </div>

              {/* SOLANA RENT-RECLAIM & BURN/CLOSE STRATEGY */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.1))',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontWeight: 700, fontSize: '0.92rem' }}>
                    <Flame size={18} />
                    <span>Solana Rent-Reclaim Strategy (Burn / Close Token Dulu Sebelum Transfer)</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={solanaBurnAndCloseTokens}
                      onChange={(e) => setSolanaBurnAndCloseTokens(e.target.checked)}
                    />
                    <span>Otomatis Burn & Close Token SPL</span>
                  </label>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>Sesuai instruksi Anda:</strong> Sebelum saldo native SOL ditransfer, sistem akan 
                  <strong> membakar debu token & menutup seluruh akun token SPL (SPL & Token-2022)</strong> untuk menarik kembali deposit sewa (rent ~0.00204 SOL per token) langsung ke wallet backup, lalu <strong>seluruh saldo native SOL ditransfer 100%</strong> tanpa meninggalkan sisa sewa di blockchain.
                </p>
              </div>

              {/* BACKUP COMPLETENESS WARNING ALERT IF ANY CHAIN LACKS DESTINATION */}
              {missingDestinations.length > 0 && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 700, fontSize: '0.88rem' }}>
                    <AlertTriangle size={16} />
                    <span>Perhatian: Ada Rantai yang Belum Memiliki Alamat Backup!</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Ditemukan aset terpilih pada rantai berikut yang belum memiliki alamat backup tujuan. Harap lengkapi alamat di bawah agar <strong>seluruh aset ter-backup 100%</strong>:
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {missingDestinations.map((m) => (
                      <span
                        key={m.chainType}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 600,
                        }}
                      >
                        {m.label} ({m.count} aset)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* QUICK FILL VIA MASTER SEED PHRASE ACCORDION */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowMnemonicHelper(!showMnemonicHelper)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#38bdf8" />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8' }}>
                      Isi Otomatis Seluruh Alamat dengan Mnemonic Master
                    </span>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    {showMnemonicHelper ? 'Tutup' : 'Buka Pengisi Otomatis'}
                  </button>
                </div>

                {showMnemonicHelper && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Masukkan 12-24 kata seed phrase dari wallet utama Anda. Sistem akan otomatis menurunkan alamat EVM, Solana, TRON, Litecoin, dan Bitcoin secara lokal tanpa mengirimnya ke mana pun.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="abandon abandon abandon ... (12-24 kata)"
                        value={masterMnemonicInput}
                        onChange={(e) => setMasterMnemonicInput(e.target.value)}
                        style={{ flex: 1, fontSize: '0.82rem' }}
                      />
                      <button className="btn btn-accent btn-sm" onClick={handleDeriveFromMnemonic}>
                        <Zap size={14} />
                        <span>Ekstrak Alamat</span>
                      </button>
                    </div>
                    {mnemonicError && (
                      <span style={{ fontSize: '0.78rem', color: '#f43f5e' }}>{mnemonicError}</span>
                    )}
                    {mnemonicSuccess && (
                      <span style={{ fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} /> Berhasil mengisi alamat multi-chain secara otomatis!
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* MANUAL DESTINATION ADDRESSES FORM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet size={16} color="#10b981" /> Alamat Wallet Tujuan per Blockchain
                </span>

                {/* 1. Master EVM Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <label style={{ fontWeight: 600 }}>
                      Alamat EVM Master <span style={{ color: '#f43f5e' }}>*Wajib</span> (Ethereum, BSC / BNB, Polygon, Base, Arbitrum, AVAX, dll.)
                    </label>
                    <button
                      className="copy-btn"
                      onClick={() => handlePasteAddress(handleEvmChange)}
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    >
                      Paste
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="0x..."
                    value={destEvm}
                    onChange={(e) => handleEvmChange(e.target.value)}
                    style={{ borderColor: evmError ? '#f43f5e' : undefined }}
                  />
                  {evmError && <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>{evmError}</span>}
                </div>

                {/* Grid for other chains */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {/* Solana */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <label style={{ fontWeight: 600 }}>Alamat Solana (SOL & SPL)</label>
                      <button
                        className="copy-btn"
                        onClick={() => handlePasteAddress(handleSolChange)}
                        style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      >
                        Paste
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Base58 Solana address..."
                      value={destSol}
                      onChange={(e) => handleSolChange(e.target.value)}
                      style={{ borderColor: solError ? '#f43f5e' : undefined }}
                    />
                    {solError && <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>{solError}</span>}
                  </div>

                  {/* TRON */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <label style={{ fontWeight: 600 }}>Alamat TRON (TRX & TRC-20 USDT)</label>
                      <button
                        className="copy-btn"
                        onClick={() => handlePasteAddress(handleTronChange)}
                        style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      >
                        Paste
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="T... (TRON address)"
                      value={destTron}
                      onChange={(e) => handleTronChange(e.target.value)}
                      style={{ borderColor: tronError ? '#f43f5e' : undefined }}
                    />
                    {tronError && <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>{tronError}</span>}
                    {isDestTronActive === true && (
                      <span style={{ fontSize: '0.74rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> Alamat aktif di TRON (Transfer 100% Bebas Biaya / 0 TRX Fee via Free Bandwidth)
                      </span>
                    )}
                    {isDestTronActive === false && (
                      <div style={{ fontSize: '0.74rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(251, 191, 36, 0.25)', marginTop: 2 }}>
                        ⚠️ <strong>Alamat TRON belum aktif di blockchain.</strong> Protokol TRON mewajibkan aktivasi awal ~1.1 TRX. Sistem akan otomatis memprioritaskan wallet bersaldo &gt;= 1.2 TRX untuk mengaktivasi alamat ini.
                      </div>
                    )}
                  </div>

                  {/* Litecoin */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <label style={{ fontWeight: 600 }}>Alamat Litecoin (LTC)</label>
                      <button
                        className="copy-btn"
                        onClick={() => handlePasteAddress(handleLtcChange)}
                        style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      >
                        Paste
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="ltc1... atau L..."
                      value={destLtc}
                      onChange={(e) => handleLtcChange(e.target.value)}
                      style={{ borderColor: ltcError ? '#f43f5e' : undefined }}
                    />
                    {ltcError && <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>{ltcError}</span>}
                  </div>

                  {/* Bitcoin */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <label style={{ fontWeight: 600 }}>Alamat Bitcoin (BTC)</label>
                      <button
                        className="copy-btn"
                        onClick={() => handlePasteAddress(handleBtcChange)}
                        style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      >
                        Paste
                      </button>
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="bc1... atau 1..."
                      value={destBtc}
                      onChange={(e) => handleBtcChange(e.target.value)}
                      style={{ borderColor: btcError ? '#f43f5e' : undefined }}
                    />
                    {btcError && <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>{btcError}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ASSET INVENTORY & SELECTION */}
          {/* ========================================================================= */}
          {activeStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Filter and search controls */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Cari koin, token, wallet..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 32, fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* Chain Filter Dropdown */}
                  <select
                    className="input-field"
                    value={selectedChainFilter}
                    onChange={(e) => handleChainFilterChange(e.target.value)}
                    style={{ width: 'auto', fontSize: '0.82rem' }}
                  >
                    <option value="all">Semua Rantai ({sweeperAssets.length})</option>
                    {SUPPORTED_CHAINS.filter((c) => (chainAssetCounts[c.id] || 0) > 0).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({chainAssetCounts[c.id]})
                      </option>
                    ))}
                  </select>

                  {/* Wallet Filter Dropdown */}
                  <select
                    className="input-field"
                    value={selectedWalletFilter}
                    onChange={(e) => handleWalletFilterChange(e.target.value)}
                    style={{ width: 'auto', fontSize: '0.82rem' }}
                  >
                    <option value="all">Semua Wallet ({targetWallets.length})</option>
                    {targetWallets.filter((w) => (walletAssetCounts[w.id] || 0) > 0).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label} ({walletAssetCounts[w.id] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Selection Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      color: '#000',
                      fontWeight: 700,
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                    }}
                    onClick={handleSelectOnlyFiltered}
                    title="Pilih HANYA aset yang tampil saat ini dan batalkan pilihan pada aset lainnya"
                  >
                    <CheckSquare size={14} /> <span>Hanya Pilih Yang Tampil ({filteredAssets.length})</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleToggleSelectFiltered(true)}
                    title="Centang semua aset yang tampil"
                  >
                    <span>Pilih Ditampilkan</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                    onClick={() => handleSelectAllGlobal(false)}
                    title="Batalkan centang pada semua aset"
                  >
                    <Square size={14} /> <span>Batal Semua</span>
                  </button>
                </div>
              </div>

              {/* Active Selection Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status Transfer:</span>
                  <strong style={{ color: '#34d399' }}>{selectedAssets.length} Aset Terpilih</strong>
                  <span style={{ color: 'var(--text-muted)' }}>dari {sweeperAssets.length} total aset</span>
                  <span style={{ color: 'var(--text-secondary)' }}>(${totalSelectedValueUsd.toFixed(2)} USD)</span>
                </div>
                {(selectedChainFilter !== 'all' || selectedWalletFilter !== 'all' || searchQuery) && (
                  <span style={{ color: '#38bdf8' }}>
                    Menampilkan: {filteredAssets.length} aset sesuai filter
                  </span>
                )}
              </div>

              {/* ASSETS TABLE */}
              <div
                style={{
                  maxHeight: 380,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.25)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#0e131f', zIndex: 5 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px', width: 40 }}>
                        <input
                          type="checkbox"
                          checked={areAllFilteredSelected}
                          onChange={() => handleToggleSelectFiltered(!areAllFilteredSelected)}
                          title="Pilih / Batal Semua Ditampilkan"
                        />
                      </th>
                      <th style={{ padding: '10px 12px' }}>Aset / Token</th>
                      <th style={{ padding: '10px 12px' }}>Blockchain</th>
                      <th style={{ padding: '10px 12px' }}>Sumber Wallet</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Jumlah Saldo</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valuasi USD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Gas Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => (
                        <tr
                          key={asset.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: asset.selected ? 'rgba(16, 185, 129, 0.04)' : undefined,
                          }}
                        >
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="checkbox"
                              checked={asset.selected}
                              onChange={() => handleToggleAsset(asset.id)}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700 }}>{asset.symbol}</span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: asset.isNative ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                  color: asset.isNative ? '#60a5fa' : '#c084fc',
                                }}
                              >
                                {asset.isNative ? 'COIN' : 'TOKEN'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{asset.name}</div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontWeight: 600 }}>{asset.chainName}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{asset.walletLabel}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {asset.fromAddress.slice(0, 6)}...{asset.fromAddress.slice(-4)}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {parseFloat(asset.balance) > 0.0001
                              ? parseFloat(asset.balance).toFixed(4)
                              : asset.balance}{' '}
                            {asset.symbol}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                            ${asset.valueUsd.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {asset.needsBnbGasDispense ? (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: '9999px',
                                  background: 'rgba(243, 186, 47, 0.2)',
                                  color: '#facc15',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Flame size={10} /> Perlu Fee BNB
                              </span>
                            ) : asset.isNative ? (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: '9999px',
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#93c5fd',
                                }}
                              >
                                Auto-Deduct Fee
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: '9999px',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                }}
                              >
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                          Tidak ada aset yang cocok dengan kriteria pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: EXECUTION & LIVE PROGRESS */}
          {/* ========================================================================= */}
          {activeStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Progress banner */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isExecuting && <RefreshCw size={16} className="scanning-pulse" color="#10b981" />}
                    <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {executionPhase === 'dispense' && 'Fase 1: Mendistribusikan Gas Fee BNB ke Wallet yang Membutuhkan...'}
                      {executionPhase === 'tokens' && 'Fase 2: Mentransfer Seluruh Token Kripto (ERC20, BEP20, TRC20, SPL)...'}
                      {executionPhase === 'natives' && 'Fase 3: Mengosongkan & Sweep Koin Native (ETH, BNB Sisa, TRX, LTC, BTC, SOL)...'}
                      {executionPhase === 'done' && '🎉 Selesai! Seluruh Aset Berhasil Ditransfer ke Satu Wallet'}
                      {executionPhase === 'idle' && 'Menunggu Konfirmasi Eksekusi'}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>{percentComplete}%</span>
                </div>

                {/* Progress bar track */}
                <div className="progress-bar-track" style={{ height: 8 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percentComplete}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                    }}
                  />
                </div>
              </div>

              {/* LIVE EXECUTION LOGS TERMINAL */}
              <div
                style={{
                  maxHeight: 340,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: '#04070d',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                }}
              >
                {executionLogs.length > 0 ? (
                  executionLogs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: log.status === 'success' 
                          ? 'rgba(16, 185, 129, 0.08)' 
                          : log.status === 'skipped'
                          ? 'rgba(234, 179, 8, 0.08)'
                          : log.status === 'failed' 
                          ? 'rgba(244, 63, 94, 0.08)' 
                          : 'rgba(255, 255, 255, 0.03)',
                        borderLeft: `3px solid ${
                          log.status === 'success' ? '#10b981' : log.status === 'skipped' ? '#eab308' : log.status === 'failed' ? '#f43f5e' : '#38bdf8'
                        }`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {log.status === 'success' ? (
                            <CheckCircle2 size={14} color="#10b981" />
                          ) : log.status === 'skipped' ? (
                            <span style={{ fontSize: '0.68rem', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                              DILEWATI (SCAM / MULTI-SIG)
                            </span>
                          ) : log.status === 'failed' ? (
                            <XCircle size={14} color="#f43f5e" />
                          ) : (
                            <RefreshCw size={14} className="scanning-pulse" color="#38bdf8" />
                          )}
                          <span style={{ fontWeight: 700, color: '#fff' }}>[{log.chainName}]</span>
                          <span>{log.amount}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                        Dari: {log.fromAddress.slice(0, 8)}... -&gt; Ke: {log.toAddress.slice(0, 8)}...
                      </div>

                      {log.txHash && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ color: '#34d399' }}>TX: {log.txHash.slice(0, 16)}...</span>
                          <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(log.txHash!, `tx_${idx}`)}
                            title="Salin Hash Transaksi"
                            style={{ padding: '1px 4px', fontSize: '0.7rem' }}
                          >
                            {copiedHash === `tx_${idx}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                          {log.explorerUrl && (
                            <a
                              href={log.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                            >
                              <span>Explorer</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      )}

                      {log.error && (
                        <div style={{ color: '#f43f5e', fontSize: '0.72rem' }}>
                          Error: {log.error}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    {isExecuting ? 'Menyiapkan dan menandatangani transaksi...' : 'Klik "Mulai Transfer" untuk memulai siaran transaksi.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.4)',
          }}
        >
          <div>
            {activeStep === 1 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Pastikan alamat EVM tujuan Anda benar sebelum melanjutkan.
              </span>
            )}
            {activeStep === 2 && (
              <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>
                {selectedAssets.length} Aset Terpilih (${totalSelectedValueUsd.toFixed(2)} USD)
              </span>
            )}
            {activeStep === 3 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isExecuting ? 'Mohon jangan menutup browser hingga proses selesai.' : 'Eksekusi selesai.'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {activeStep > 1 && !isExecuting && (
              <button className="btn btn-secondary" onClick={() => setActiveStep((prev) => (prev - 1) as any)}>
                Kembali
              </button>
            )}

            {activeStep === 1 && (
              <button
                className="btn btn-primary"
                disabled={!isConfigValid}
                onClick={() => setActiveStep(2)}
              >
                <span>Tinjau Aset ({selectedAssets.length})</span>
                <ArrowRight size={16} />
              </button>
            )}

            {activeStep === 2 && (
              <button
                className="btn btn-accent"
                disabled={selectedAssets.length === 0}
                onClick={handleStartSweep}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                }}
              >
                <Send size={16} />
                <span>Mulai Transfer ({selectedAssets.length} Aset)</span>
              </button>
            )}

            {activeStep === 3 && (
              <button className="btn btn-secondary" onClick={onClose} disabled={isExecuting}>
                {isExecuting ? 'Sedang Memproses...' : 'Tutup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

