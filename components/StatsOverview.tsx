import React from 'react';
import { DollarSign, Wallet, CheckCircle2, Globe, Flame, Image } from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { SUPPORTED_CHAINS } from '../config/chains';

interface StatsOverviewProps {
  wallets: ParsedWalletItem[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ wallets }) => {
  const totalMainnetUsd = wallets.reduce((acc, w) => acc + (w.totalMainnetValueUsd || 0), 0);
  const fundedWalletsCount = wallets.filter((w) => w.hasAnyBalance).length;
  
  // Count NFTs
  const totalNftsCount = wallets.reduce((acc, w) => acc + (w.totalNftCount || 0), 0);
  const totalNftUsd = wallets.reduce((acc, w) => acc + (w.totalNftValueUsd || 0), 0);

  // Count by wallet type
  const mnemonicsCount = wallets.filter((w) => w.type === 'mnemonic').length;
  const privateKeysCount = wallets.filter((w) => w.type === 'privateKey').length;
  const addressesCount = wallets.filter((w) => w.type === 'address').length;

  // Count active chains with balances
  const activeChainsSet = new Set<string>();
  let testnetAssetsCount = 0;

  for (const w of wallets) {
    for (const [chainId, asset] of Object.entries(w.chainAssets || {})) {
      if (asset.hasBalance) {
        activeChainsSet.add(chainId);
        if (asset.category === 'testnet') {
          testnetAssetsCount++;
        }
      }
    }
  }

  const mainnetChainsCount = SUPPORTED_CHAINS.filter((c) => c.category === 'mainnet').length;
  const testnetChainsCount = SUPPORTED_CHAINS.filter((c) => c.category === 'testnet').length;

  return (
    <div className="stats-grid">
      {/* 1. Total Portfolio USD */}
      <div className="glass-card stat-card" style={{ '--card-accent': '#10b981' } as any}>
        <div className="stat-info">
          <span className="stat-label">Total Asset (Token & NFT USD)</span>
          <span className="stat-value" style={{ color: '#34d399' }}>
            ${totalMainnetUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="stat-sub">
            Valuasi harga pasar real-time
          </span>
        </div>
        <div className="stat-icon-wrapper" style={{ color: '#10b981' }}>
          <DollarSign size={24} />
        </div>
      </div>

      {/* 2. Total Wallets Monitored */}
      <div className="glass-card stat-card" style={{ '--card-accent': '#06b6d4' } as any}>
        <div className="stat-info">
          <span className="stat-label">Total Wallet Dipantau</span>
          <span className="stat-value">{wallets.length}</span>
          <span className="stat-sub">
            {mnemonicsCount} Mnemonics • {privateKeysCount} Keys • {addressesCount} Addr
          </span>
        </div>
        <div className="stat-icon-wrapper" style={{ color: '#06b6d4' }}>
          <Wallet size={24} />
        </div>
      </div>

      {/* 3. Funded Wallets (> 0) */}
      <div className="glass-card stat-card" style={{ '--card-accent': '#8b5cf6' } as any}>
        <div className="stat-info">
          <span className="stat-label">Wallet Berisi Saldo / NFT</span>
          <span className="stat-value" style={{ color: fundedWalletsCount > 0 ? '#a78bfa' : 'var(--text-primary)' }}>
            {fundedWalletsCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {wallets.length}</span>
          </span>
          <span className="stat-sub">
            {fundedWalletsCount > 0
              ? `${((fundedWalletsCount / (wallets.length || 1)) * 100).toFixed(0)}% wallet memiliki aset`
              : 'Belum ada aset terdeteksi'}
          </span>
        </div>
        <div className="stat-icon-wrapper" style={{ color: '#8b5cf6' }}>
          <CheckCircle2 size={24} />
        </div>
      </div>

      {/* 4. NFT Portfolio */}
      <div className="glass-card stat-card" style={{ '--card-accent': '#a855f7' } as any}>
        <div className="stat-info">
          <span className="stat-label">Koleksi NFT Terdeteksi</span>
          <span className="stat-value" style={{ color: '#c084fc' }}>
            {totalNftsCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>NFTs</span>
          </span>
          <span className="stat-sub">
            {totalNftUsd > 0 ? `Nilai: $${totalNftUsd.toFixed(2)} USD` : 'EVM & Solana Metaplex'}
          </span>
        </div>
        <div className="stat-icon-wrapper" style={{ color: '#a855f7' }}>
          <Image size={24} />
        </div>
      </div>

      {/* 5. Active Chains & Testnets */}
      <div className="glass-card stat-card" style={{ '--card-accent': '#f59e0b' } as any}>
        <div className="stat-info">
          <span className="stat-label">Jaringan Terpantau</span>
          <span className="stat-value">
            {SUPPORTED_CHAINS.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>chains</span>
          </span>
          <span className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{mainnetChainsCount} Mainnets</span> • <span>{testnetChainsCount} Testnets</span>
            {testnetAssetsCount > 0 && (
              <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Flame size={12} /> {testnetAssetsCount} Faucets
              </span>
            )}
          </span>
        </div>
        <div className="stat-icon-wrapper" style={{ color: '#f59e0b' }}>
          <Globe size={24} />
        </div>
      </div>
    </div>
  );
};

