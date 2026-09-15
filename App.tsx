import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  XCircle,
  Database
} from 'lucide-react';
import { ParsedWalletItem, FilterOptions, ChainAsset } from './types/wallet';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { NetworkFilterBar } from './components/NetworkFilterBar';
import { WalletCard } from './components/WalletCard';
import { WalletTable } from './components/WalletTable';
import { BatchActionBar } from './components/BatchActionBar';
import { ImportModal } from './components/ImportModal';
import { WalletDetailModal } from './components/WalletDetailModal';
import { AssetDistributionModal } from './components/AssetDistributionModal';
import { SolanaBurnModal } from './components/SolanaBurnModal';
import { TransferAllModal } from './components/TransferAllModal';
import { RpcSettingsModal } from './components/RpcSettingsModal';
import { LiveLogTerminal } from './components/LiveLogTerminal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Pagination } from './components/Pagination';
import { scanAllWallets, scanSingleWallet } from './services/scanner';
import { fetchLiveCryptoPrices } from './services/priceFeed';
import { SUPPORTED_CHAINS } from './config/chains';
import { logger } from './services/logger';
import { loadWalletsFromStorage, saveWalletsToStorage, clearWalletsStorage } from './services/storageService';

export const App: React.FC = () => {
  const [wallets, setWallets] = useState<ParsedWalletItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [selectedWalletIds, setSelectedWalletIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isSolanaBurnOpen, setIsSolanaBurnOpen] = useState(false);
  const [isTransferAllOpen, setIsTransferAllOpen] = useState(false);
  const [transferSubsetIds, setTransferSubsetIds] = useState<Set<string> | undefined>(undefined);
  const [isRpcSettingsOpen, setIsRpcSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [detailWallet, setDetailWallet] = useState<ParsedWalletItem | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Pagination state for 1,000+ wallets (Zero DOM Lag)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [scanProgress, setScanProgress] = useState<{
    isScanning: boolean;
    scannedWallets: number;
    totalWallets: number;
    currentWalletLabel: string;
    currentChain: string;
    percent: number;
  }>({
    isScanning: false,
    scannedWallets: 0,
    totalWallets: 0,
    currentWalletLabel: '',
    currentChain: '',
    percent: 0,
  });

  const abortControllerRef = useRef<{ aborted: boolean }>({ aborted: false });

  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: 'all',
    selectedChainId: 'all',
    walletType: 'all',
    statusFilter: 'all',
    onlyWithBalance: false,
    sortBy: 'value-desc',
  });

  // Persistent IndexedDB save on state change
  useEffect(() => {
    if (!isLoaded) return;
    saveWalletsToStorage(wallets);
  }, [wallets, isLoaded]);

  // Initial load from IndexedDB
  useEffect(() => {
    loadWalletsFromStorage().then((loaded) => {
      setWallets(loaded);
      setIsLoaded(true);
      logger.info('SYSTEM', `JMBT Web3 Wallet Management aktif: ${loaded.length} wallet dimuat dari IndexedDB (Kapasitas Tak Terbatas).`);
    });
    fetchLiveCryptoPrices();
  }, []);

  const updateWalletInState = (updated: ParsedWalletItem) => {
    setWallets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    if (detailWallet && detailWallet.id === updated.id) {
      setDetailWallet(updated);
    }
  };

  // Import handler with optional auto-scan
  const handleImportSuccess = async (imported: ParsedWalletItem[], autoScan: boolean = true) => {
    const currentIdentifiers = new Set(
      wallets.map((w) => (w.evmAddress || w.solanaAddress || w.rawSecret).toLowerCase())
    );
    const newItems = imported.filter(
      (w) => !currentIdentifiers.has((w.evmAddress || w.solanaAddress || w.rawSecret).toLowerCase())
    );

    const combined = [...newItems, ...wallets];
    setWallets(combined);
    logger.success('PARSER', `Berhasil mengimpor ${newItems.length} wallet baru (Total: ${combined.length} wallet).`);

    // Reset pagination to first page
    setCurrentPage(1);

    // Automatically scan if enabled
    if (autoScan && newItems.length > 0) {
      triggerBatchScan(newItems, combined);
    }
  };

  // Scan single wallet
  const handleScanSingle = async (wallet: ParsedWalletItem) => {
    if (scanProgress.isScanning) return;
    try {
      updateWalletInState({ ...wallet, scanStatus: 'scanning' });
      const prices = await fetchLiveCryptoPrices();
      const updated = await scanSingleWallet(wallet, SUPPORTED_CHAINS, prices, {
        onChainUpdate: (walletId, chainId, asset) => {
          setWallets((prev) =>
            prev.map((w) => {
              if (w.id === walletId) {
                return {
                  ...w,
                  chainAssets: { ...w.chainAssets, [chainId]: asset },
                };
              }
              return w;
            })
          );
        },
      });
      updateWalletInState(updated);
    } catch (err: any) {
      updateWalletInState({ ...wallet, scanStatus: 'error', error: err.message });
      logger.error('SCAN', `Error scan ${wallet.label}: ${err.message}`);
    }
  };

  // Trigger batch scan
  const triggerBatchScan = async (walletsToScan: ParsedWalletItem[], allList: ParsedWalletItem[]) => {
    if (scanProgress.isScanning || walletsToScan.length === 0) return;

    abortControllerRef.current = { aborted: false };
    setScanProgress({
      isScanning: true,
      scannedWallets: 0,
      totalWallets: walletsToScan.length,
      currentWalletLabel: walletsToScan[0].label,
      currentChain: 'Memulai...',
      percent: 0,
    });

    const prices = await fetchLiveCryptoPrices();

    for (let i = 0; i < walletsToScan.length; i++) {
      if (abortControllerRef.current.aborted) break;
      const w = walletsToScan[i];

      setScanProgress((prev) => ({
        ...prev,
        scannedWallets: i,
        currentWalletLabel: w.label,
        percent: Math.round((i / walletsToScan.length) * 100),
      }));

      try {
        const updated = await scanSingleWallet(w, SUPPORTED_CHAINS, prices, {
          onChainUpdate: (walletId, chainId, asset) => {
            setWallets((prev) =>
              prev.map((item) => {
                if (item.id === walletId) {
                  return {
                    ...item,
                    chainAssets: { ...item.chainAssets, [chainId]: asset },
                  };
                }
                return item;
              })
            );
          },
        });
        updateWalletInState(updated);
      } catch (err: any) {
        logger.error('SCAN', `Error pada ${w.label}: ${err.message}`);
      }

      // Small 20ms pause between wallets to keep UI 60fps fluid
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    setScanProgress({
      isScanning: false,
      scannedWallets: walletsToScan.length,
      totalWallets: walletsToScan.length,
      currentWalletLabel: 'Scan Selesai',
      currentChain: 'Selesai',
      percent: 100,
    });
  };

  const handleScanAll = () => {
    triggerBatchScan(wallets, wallets);
  };

  const handleScanSelected = () => {
    const selected = wallets.filter((w) => selectedWalletIds.has(w.id));
    if (selected.length > 0) {
      triggerBatchScan(selected, wallets);
    }
  };

  const handleStopScan = () => {
    abortControllerRef.current.aborted = true;
    setScanProgress((prev) => ({ ...prev, isScanning: false }));
    logger.warn('SCAN', 'Pemindaian dihentikan secara manual.');
  };

  // Delete single wallet with In-App Confirm Dialog
  const handleDeleteWallet = (walletId: string) => {
    const target = wallets.find((w) => w.id === walletId);
    const label = target ? target.label : 'Wallet ini';

    setConfirmState({
      isOpen: true,
      title: 'Hapus Wallet',
      message: `Apakah Anda yakin ingin menghapus "${label}" dari daftar pantauan?`,
      onConfirm: () => {
        setWallets((prev) => prev.filter((w) => w.id !== walletId));
        setSelectedWalletIds((prev) => {
          const next = new Set(prev);
          next.delete(walletId);
          return next;
        });
        logger.info('SYSTEM', `Wallet "${label}" berhasil dihapus.`);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Delete selected wallets with In-App Confirm Dialog
  const handleDeleteSelected = () => {
    const count = selectedWalletIds.size;
    if (count === 0) return;

    setConfirmState({
      isOpen: true,
      title: `Hapus ${count} Wallet Terpilih`,
      message: `Apakah Anda yakin ingin menghapus ${count} wallet yang dipilih dari daftar pantauan?`,
      onConfirm: () => {
        setWallets((prev) => prev.filter((w) => !selectedWalletIds.has(w.id)));
        logger.info('SYSTEM', `${count} wallet terpilih berhasil dihapus.`);
        setSelectedWalletIds(new Set());
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Clear all wallets with In-App Confirm Dialog
  const handleClearAll = () => {
    setConfirmState({
      isOpen: true,
      title: 'Hapus Semua Wallet',
      message: 'PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA wallet dari daftar pantauan aplikasi?',
      onConfirm: () => {
        setWallets([]);
        setSelectedWalletIds(new Set());
        clearWalletsStorage();
        logger.warn('SYSTEM', 'Semua data wallet telah dibersihkan dari penyimpanan.');
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleUpdateLabel = (walletId: string, newLabel: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === walletId ? { ...w, label: newLabel } : w))
    );
  };

  // Selection handlers
  const handleToggleSelect = (walletId: string) => {
    setSelectedWalletIds((prev) => {
      const next = new Set(prev);
      if (next.has(walletId)) next.delete(walletId);
      else next.add(walletId);
      return next;
    });
  };

  // Filter and sort logic
  const filteredWallets = useMemo(() => {
    let result = [...wallets];

    // 1. Search filter
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter((w) => {
        const matchLabel = w.label.toLowerCase().includes(q);
        const matchEvm = w.evmAddress?.toLowerCase().includes(q);
        const matchSol = w.solanaAddress?.toLowerCase().includes(q);
        const matchTags = (w.tags || []).some((t) => t.toLowerCase().includes(q));

        const matchToken = Object.values(w.chainAssets || {}).some((a) =>
          a.tokens.some((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
        );

        return matchLabel || matchEvm || matchSol || matchTags || matchToken;
      });
    }

    // 2. Status Filter
    if (filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'needs_rescan') {
        result = result.filter((w) => w.scanStatus === 'idle' || w.scanStatus === 'error');
      } else if (filters.statusFilter === 'funded') {
        result = result.filter((w) => w.hasAnyBalance);
      } else if (filters.statusFilter === 'zero_fund') {
        result = result.filter((w) => w.scanStatus === 'done' && !w.hasAnyBalance);
      } else if (filters.statusFilter === 'scanned') {
        result = result.filter((w) => w.scanStatus === 'done');
      }
    }

    // 3. Category filter
    if (filters.category !== 'all') {
      if (filters.category === 'mainnet') {
        if (filters.onlyWithBalance) {
          result = result.filter((w) => (w.totalMainnetValueUsd || 0) > 0);
        }
      } else if (filters.category === 'testnet') {
        if (filters.onlyWithBalance) {
          result = result.filter((w) =>
            Object.values(w.chainAssets || {}).some((a) => a.category === 'testnet' && a.hasBalance)
          );
        }
      }
    }

    // 3. Selected specific chain filter
    if (filters.selectedChainId !== 'all') {
      result = result.filter((w) => {
        const asset = w.chainAssets?.[filters.selectedChainId];
        if (filters.onlyWithBalance) {
          return !!asset && asset.hasBalance;
        }
        const chainConf = SUPPORTED_CHAINS.find((c) => c.id === filters.selectedChainId);
        if (chainConf?.type === 'evm' && w.evmAddress) return true;
        if (chainConf?.type === 'solana' && w.solanaAddress) return true;
        return false;
      });
    }

    // 4. Wallet Type filter
    if (filters.walletType !== 'all') {
      result = result.filter((w) => w.type === filters.walletType);
    }

    // 5. Only with balance filter (overall)
    if (filters.onlyWithBalance && filters.category === 'all' && filters.selectedChainId === 'all') {
      result = result.filter((w) => w.hasAnyBalance);
    }

    // 6. Sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'value-desc') {
        return (b.totalMainnetValueUsd || 0) - (a.totalMainnetValueUsd || 0);
      }
      if (filters.sortBy === 'value-asc') {
        return (a.totalMainnetValueUsd || 0) - (b.totalMainnetValueUsd || 0);
      }
      if (filters.sortBy === 'chains-desc') {
        return (b.nonZeroChainsCount || 0) - (a.nonZeroChainsCount || 0);
      }
      if (filters.sortBy === 'label-asc') {
        return a.label.localeCompare(b.label);
      }
      if (filters.sortBy === 'created-desc') {
        return b.createdAt - a.createdAt;
      }
      return 0;
    });

    return result;
  }, [wallets, filters]);

  // Paginated slice
  const paginatedWallets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWallets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWallets, currentPage, itemsPerPage]);

  const handleSelectAllFiltered = () => {
    setSelectedWalletIds(new Set(filteredWallets.map((w) => w.id)));
  };

  const handleDeselectAll = () => {
    setSelectedWalletIds(new Set());
  };

  const selectedWalletsList = useMemo(() => {
    return wallets.filter((w) => selectedWalletIds.has(w.id));
  }, [wallets, selectedWalletIds]);

  const needsRescanCount = useMemo(() => {
    return wallets.filter((w) => w.scanStatus === 'idle' || w.scanStatus === 'error').length;
  }, [wallets]);

  const fundedCount = useMemo(() => {
    return wallets.filter((w) => w.hasAnyBalance).length;
  }, [wallets]);

  const zeroFundCount = useMemo(() => {
    return wallets.filter((w) => w.scanStatus === 'done' && !w.hasAnyBalance).length;
  }, [wallets]);

  const scannedCount = useMemo(() => {
    return wallets.filter((w) => w.scanStatus === 'done').length;
  }, [wallets]);

  const handleScanNeedsRescan = () => {
    if (scanProgress.isScanning) return;
    const targets = wallets.filter((w) => w.scanStatus === 'idle' || w.scanStatus === 'error');
    if (targets.length > 0) {
      triggerBatchScan(targets, wallets);
    }
  };

  return (
    <div className="app-container" style={{ paddingBottom: isLogsOpen ? '280px' : '64px' }}>
      {/* Navbar */}
      <Navbar
        wallets={wallets}
        isScanning={scanProgress.isScanning}
        isLogsOpen={isLogsOpen}
        onToggleLogs={() => setIsLogsOpen(!isLogsOpen)}
        onOpenImport={() => setIsImportOpen(true)}
        onScanAll={handleScanAll}
        onClearAll={handleClearAll}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenRpcSettings={() => setIsRpcSettingsOpen(true)}
        onOpenTransferAll={() => {
          if (filteredWallets.length > 0 && filteredWallets.length < wallets.length) {
            setTransferSubsetIds(new Set(filteredWallets.map((w) => w.id)));
          } else {
            setTransferSubsetIds(undefined);
          }
          setIsTransferAllOpen(true);
        }}
      />

      {/* Stats Overview */}
      <StatsOverview wallets={wallets} />

      {/* Live Scan Progress Card */}
      {scanProgress.isScanning && (
        <div className="progress-card">
          <div className="progress-header">
            <div className="progress-title">
              <RefreshCw size={18} className="scanning-pulse" />
              <span>Memindai Saldo Multi-Chain: {scanProgress.currentWalletLabel}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={handleStopScan}>
              <XCircle size={14} /> Berhenti
            </button>
          </div>

          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${scanProgress.percent}%` }} />
          </div>

          <div className="progress-footer">
            <span>
              Proses: {scanProgress.scannedWallets} dari {scanProgress.totalWallets} wallet ({scanProgress.percent}%)
            </span>
            <span>Memeriksa Tokens & Native di 18+ Blockchains...</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {wallets.length === 0 ? (
        /* Empty State */
        <div className="glass-card empty-state">
          <div className="empty-icon">
            <Zap size={36} color="#10b981" />
          </div>
          <h2 className="empty-title">Belum Ada Wallet yang Dipantau</h2>
          <p className="empty-desc">
            Import file <code>.txt</code> (1000+ baris wallet) untuk mulai memantau aset secara bertahap tanpa lag.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => setIsImportOpen(true)}>
              <Plus size={18} />
              <span>Import File Wallet (.txt)</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12 }}>
            <ShieldCheck size={14} color="#10b981" /> Semua kunci diproses 100% lokal di browser tanpa server pihak ketiga.
          </div>
        </div>
      ) : (
        <>
          {/* Controls & Filter Bar */}
          <NetworkFilterBar
            filters={filters}
            onFilterChange={(newF) => {
              setFilters((prev) => ({ ...prev, ...newF }));
              setCurrentPage(1);
            }}
            totalFiltered={filteredWallets.length}
            totalWallets={wallets.length}
            needsRescanCount={needsRescanCount}
            fundedCount={fundedCount}
            zeroFundCount={zeroFundCount}
            scannedCount={scannedCount}
            isScanning={scanProgress.isScanning}
            onScanNeedsRescan={handleScanNeedsRescan}
          />

          {/* Batch Action Bar */}
          <BatchActionBar
            selectedWallets={selectedWalletsList}
            allFilteredWallets={filteredWallets}
            isScanning={scanProgress.isScanning}
            onSelectAll={handleSelectAllFiltered}
            onDeselectAll={handleDeselectAll}
            onScanSelected={handleScanSelected}
            onOpenSolanaBurn={() => setIsSolanaBurnOpen(true)}
            onOpenTransferAll={() => {
              setTransferSubsetIds(new Set(selectedWalletIds));
              setIsTransferAllOpen(true);
            }}
            onDeleteSelected={handleDeleteSelected}
          />

          {/* View mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total <strong style={{ color: 'var(--text-primary)' }}>{filteredWallets.length}</strong> wallet ditemukan
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tampilan:</span>
              <button
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px' }}
                onClick={() => setViewMode('cards')}
                title="Card View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px' }}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Wallet List (Paginated for 60FPS fluid experience with 1000+ items) */}
          {filteredWallets.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Tidak ada wallet yang sesuai dengan filter pencarian saat ini.</p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setFilters({
                    search: '',
                    category: 'all',
                    selectedChainId: 'all',
                    walletType: 'all',
                    statusFilter: 'all',
                    onlyWithBalance: false,
                    sortBy: 'value-desc',
                  });
                  setCurrentPage(1);
                }}
              >
                Reset Semua Filter
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="wallets-container">
              {paginatedWallets.map((wallet) => (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  isScanning={scanProgress.isScanning}
                  isSelected={selectedWalletIds.has(wallet.id)}
                  onToggleSelect={handleToggleSelect}
                  onScanSingle={handleScanSingle}
                  onDelete={handleDeleteWallet}
                  onViewDetails={(w) => setDetailWallet(w)}
                  onUpdateLabel={handleUpdateLabel}
                />
              ))}
            </div>
          ) : (
            <WalletTable
              wallets={paginatedWallets}
              isScanning={scanProgress.isScanning}
              selectedIds={selectedWalletIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={() => {
                if (filteredWallets.every((w) => selectedWalletIds.has(w.id))) {
                  handleDeselectAll();
                } else {
                  handleSelectAllFiltered();
                }
              }}
              onScanSingle={handleScanSingle}
              onDelete={handleDeleteWallet}
              onViewDetails={(w) => setDetailWallet(w)}
            />
          )}

          {/* Responsive Pagination for large lists */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredWallets.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Wallet Detail Modal */}
      <WalletDetailModal
        wallet={detailWallet}
        onClose={() => setDetailWallet(null)}
        onScanSingle={handleScanSingle}
        isScanning={scanProgress.isScanning}
        onOpenTransfer={(w) => {
          setTransferSubsetIds(new Set([w.id]));
          setIsTransferAllOpen(true);
        }}
      />

      {/* Asset Distribution Analytics Modal */}
      <AssetDistributionModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        wallets={wallets}
      />

      {/* Solana Burn & Rent Reclaim Modal */}
      <SolanaBurnModal
        isOpen={isSolanaBurnOpen}
        onClose={() => setIsSolanaBurnOpen(false)}
        selectedWallets={selectedWalletsList.length > 0 ? selectedWalletsList : wallets}
        onSuccessRefresh={() => {
          handleScanAll();
        }}
      />

      {/* Transfer All to One Wallet Modal */}
      {isTransferAllOpen && (
        <TransferAllModal
          isOpen={isTransferAllOpen}
          onClose={() => setIsTransferAllOpen(false)}
          wallets={wallets}
          selectedSubsetIds={transferSubsetIds}
          initialChainId={filters.selectedChainId !== 'all' ? filters.selectedChainId : undefined}
          onSuccessRefresh={() => {
            handleScanAll();
          }}
        />
      )}

      {/* Live Log Terminal Console */}
      <LiveLogTerminal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />

      {/* Custom RPC Settings Modal */}
      <RpcSettingsModal
        isOpen={isRpcSettingsOpen}
        onClose={() => setIsRpcSettingsOpen(false)}
      />

      {/* Custom In-App Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

