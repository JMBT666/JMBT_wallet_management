import React from 'react';
import { Search, SlidersHorizontal, Check, AlertTriangle, Coins, CircleOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { FilterOptions } from '../types/wallet';
import { SUPPORTED_CHAINS } from '../config/chains';

interface NetworkFilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
  totalFiltered: number;
  totalWallets: number;
  needsRescanCount: number;
  fundedCount: number;
  zeroFundCount: number;
  scannedCount: number;
  isScanning: boolean;
  onScanNeedsRescan: () => void;
}

export const NetworkFilterBar: React.FC<NetworkFilterBarProps> = ({
  filters,
  onFilterChange,
  totalFiltered,
  totalWallets,
  needsRescanCount,
  fundedCount,
  zeroFundCount,
  scannedCount,
  isScanning,
  onScanNeedsRescan,
}) => {
  // Filter chains based on selected category (all / mainnet / testnet)
  const visibleChains = SUPPORTED_CHAINS.filter((c) => {
    if (filters.category === 'mainnet') return c.category === 'mainnet';
    if (filters.category === 'testnet') return c.category === 'testnet';
    return true;
  });

  return (
    <div className="glass-card filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      
      {/* 1. Status Filter Tabs (Semua / Belum Dicek & Error / Ada Saldo / 0 Fund / Selesai) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Semua */}
          <button
            className={`btn btn-sm ${filters.statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onFilterChange({ statusFilter: 'all' })}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Semua Status</span>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '9999px' }}>
              {totalWallets}
            </span>
          </button>

          {/* Belum Dicek / Gagal Scan */}
          <button
            className={`btn btn-sm ${filters.statusFilter === 'needs_rescan' ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => onFilterChange({ statusFilter: 'needs_rescan' })}
            style={{ 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              borderColor: needsRescanCount > 0 ? '#f43f5e' : undefined
            }}
          >
            <AlertTriangle size={13} color={filters.statusFilter === 'needs_rescan' ? '#fff' : '#f43f5e'} />
            <span>Belum Dicek / Gagal Scan</span>
            <span style={{ 
              fontSize: '0.7rem', 
              background: filters.statusFilter === 'needs_rescan' ? '#fff' : '#f43f5e', 
              color: filters.statusFilter === 'needs_rescan' ? '#f43f5e' : '#fff', 
              padding: '1px 6px', 
              borderRadius: '9999px',
              fontWeight: 800
            }}>
              {needsRescanCount}
            </span>
          </button>

          {/* Ada Saldo (Funded > 0) */}
          <button
            className={`btn btn-sm ${filters.statusFilter === 'funded' ? 'btn-accent' : 'btn-secondary'}`}
            onClick={() => onFilterChange({ statusFilter: 'funded' })}
            style={{ 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              borderColor: fundedCount > 0 ? '#10b981' : undefined
            }}
          >
            <Coins size={13} color={filters.statusFilter === 'funded' ? '#000' : '#10b981'} />
            <span>Ada Saldo (Funded)</span>
            <span style={{ 
              fontSize: '0.7rem', 
              background: filters.statusFilter === 'funded' ? '#000' : '#10b981', 
              color: filters.statusFilter === 'funded' ? '#10b981' : '#fff', 
              padding: '1px 6px', 
              borderRadius: '9999px',
              fontWeight: 800
            }}>
              {fundedCount}
            </span>
          </button>

          {/* 0 Fund (Saldo Kosong) */}
          <button
            className={`btn btn-sm ${filters.statusFilter === 'zero_fund' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onFilterChange({ statusFilter: 'zero_fund' })}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CircleOff size={13} />
            <span>0 Fund (Saldo Kosong)</span>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '9999px' }}>
              {zeroFundCount}
            </span>
          </button>

          {/* Selesai Dicek */}
          <button
            className={`btn btn-sm ${filters.statusFilter === 'scanned' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onFilterChange({ statusFilter: 'scanned' })}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckCircle2 size={13} />
            <span>Selesai Dicek</span>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '9999px' }}>
              {scannedCount}
            </span>
          </button>
        </div>

        {/* Quick Action: Scan Ulang yang Belum / Gagal */}
        {needsRescanCount > 0 && (
          <button
            className="btn btn-sm btn-accent"
            onClick={onScanNeedsRescan}
            disabled={isScanning}
            style={{ 
              fontSize: '0.78rem', 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              background: '#f59e0b',
              borderColor: '#f59e0b',
              color: '#000'
            }}
            title="Scan ulang hanya wallet yang belum pernah dicek atau yang tadi gagal/rate-limit"
          >
            <RefreshCw size={13} className={isScanning ? 'scanning-pulse' : ''} />
            <span>🔄 Scan Ulang yang Belum / Gagal ({needsRescanCount})</span>
          </button>
        )}
      </div>

      {/* 2. Search & Controls */}
      <div className="filter-row-top" style={{ marginTop: 0 }}>
        {/* Search */}
        <div className="search-box">
          <Search size={17} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari label, address (0x...), token, atau tag..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
        </div>

        {/* Category Tabs: All / Mainnet / Testnet */}
        <div className="category-tabs">
          <button
            className={`tab-btn ${filters.category === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange({ category: 'all', selectedChainId: 'all' })}
          >
            Semua Jaringan
          </button>
          <button
            className={`tab-btn ${filters.category === 'mainnet' ? 'active' : ''}`}
            onClick={() => onFilterChange({ category: 'mainnet', selectedChainId: 'all' })}
          >
            🌐 Mainnet Only
          </button>
          <button
            className={`tab-btn ${filters.category === 'testnet' ? 'active' : ''}`}
            onClick={() => onFilterChange({ category: 'testnet', selectedChainId: 'all' })}
          >
            🧪 Testnet Only
          </button>
        </div>

        {/* Filter Controls Group */}
        <div className="filter-controls">
          {/* Wallet Type */}
          <select
            className="select-control"
            value={filters.walletType}
            onChange={(e) => onFilterChange({ walletType: e.target.value as any })}
            title="Tipe Wallet"
          >
            <option value="all">Semua Tipe Key</option>
            <option value="mnemonic">🔑 Mnemonic Seed Phrase</option>
            <option value="privateKey">🗝️ Private Key</option>
            <option value="address">👀 Public Address</option>
          </select>

          {/* Sort By */}
          <select
            className="select-control"
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
            title="Urutkan Berdasarkan"
          >
            <option value="value-desc">💰 Saldo Tertinggi ($ USD)</option>
            <option value="value-asc">💵 Saldo Terendah</option>
            <option value="chains-desc">🔗 Jaringan Terbanyak</option>
            <option value="label-asc">🔤 Nama Label (A-Z)</option>
            <option value="created-desc">⏱️ Urutan Import Terbaru</option>
          </select>
        </div>
      </div>

      {/* 3. Network Filter Pills */}
      <div className="filter-row-chains">
        <button
          className={`chain-pill ${filters.selectedChainId === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange({ selectedChainId: 'all' })}
        >
          {filters.selectedChainId === 'all' && <Check size={12} />}
          <span>Semua ({visibleChains.length})</span>
        </button>

        {visibleChains.map((chain) => {
          const isSelected = filters.selectedChainId === chain.id;
          return (
            <button
              key={chain.id}
              className={`chain-pill ${isSelected ? 'active' : ''}`}
              style={
                isSelected
                  ? ({
                      '--pill-bg': `${chain.color}25`,
                      '--pill-border': chain.color,
                      '--pill-text': '#ffffff',
                      '--pill-glow': `${chain.color}40`,
                    } as any)
                  : {}
              }
              onClick={() => onFilterChange({ selectedChainId: isSelected ? 'all' : chain.id })}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: chain.color,
                }}
              />
              <span>{chain.shortName}</span>
              {chain.category === 'testnet' && (
                <span style={{ fontSize: '0.65rem', opacity: 0.7, textTransform: 'uppercase' }}>test</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Counter indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>
          Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{totalFiltered}</strong> dari total {totalWallets} wallet
        </span>
        {filters.statusFilter !== 'all' && (
          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
            <SlidersHorizontal size={13} /> Filter Status Aktif
          </span>
        )}
      </div>
    </div>
  );
};

