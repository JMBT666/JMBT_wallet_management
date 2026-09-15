import React from 'react';
import { X, PieChart, TrendingUp, Layers, DollarSign } from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { SUPPORTED_CHAINS } from '../config/chains';

interface AssetDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: ParsedWalletItem[];
}

export const AssetDistributionModal: React.FC<AssetDistributionModalProps> = ({
  isOpen,
  onClose,
  wallets,
}) => {
  if (!isOpen) return null;

  // Aggregate assets by chain
  const chainTotals: Record<string, { name: string; shortName: string; color: string; totalUsd: number; category: string }> = {};
  const tokenTotals: Record<string, { symbol: string; name: string; totalAmount: number; totalUsd: number }> = {};

  let totalPortfolioUsd = 0;

  for (const w of wallets) {
    for (const [chainId, asset] of Object.entries(w.chainAssets || {})) {
      if (!chainTotals[chainId]) {
        const chainConf = SUPPORTED_CHAINS.find((c) => c.id === chainId);
        chainTotals[chainId] = {
          name: asset.chainName || chainConf?.name || chainId,
          shortName: asset.chainShortName || chainConf?.shortName || chainId,
          color: chainConf?.color || '#10b981',
          totalUsd: 0,
          category: asset.category,
        };
      }

      if (asset.category === 'mainnet') {
        chainTotals[chainId].totalUsd += asset.totalValueUsd || 0;
        totalPortfolioUsd += asset.totalValueUsd || 0;

        // Native token
        const nativeSym = asset.chainShortName;
        const nativeAmt = parseFloat(asset.nativeBalance || '0');
        if (nativeAmt > 0) {
          if (!tokenTotals[nativeSym]) {
            tokenTotals[nativeSym] = { symbol: nativeSym, name: `${asset.chainName} Native`, totalAmount: 0, totalUsd: 0 };
          }
          tokenTotals[nativeSym].totalAmount += nativeAmt;
          tokenTotals[nativeSym].totalUsd += asset.nativeValueUsd || 0;
        }

        // ERC-20 / SPL Tokens
        for (const tok of asset.tokens || []) {
          const tokAmt = parseFloat(tok.balance || '0');
          if (tokAmt > 0) {
            if (!tokenTotals[tok.symbol]) {
              tokenTotals[tok.symbol] = { symbol: tok.symbol, name: tok.name, totalAmount: 0, totalUsd: 0 };
            }
            tokenTotals[tok.symbol].totalAmount += tokAmt;
            tokenTotals[tok.symbol].totalUsd += tok.valueUsd || 0;
          }
        }
      }
    }
  }

  const sortedChains = Object.values(chainTotals)
    .filter((c) => c.category === 'mainnet' && c.totalUsd > 0)
    .sort((a, b) => b.totalUsd - a.totalUsd);

  const sortedTokens = Object.values(tokenTotals)
    .filter((t) => t.totalUsd > 0)
    .sort((a, b) => b.totalUsd - a.totalUsd);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon" style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
              <PieChart size={18} />
            </div>
            <div>
              <span className="modal-title">Distribusi Aset & Portofolio</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Rincian alokasi aset per blockchain dan token di seluruh wallet Anda
              </p>
            </div>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Top Metric */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TOTAL VALUASI REAL-TIME</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                ${totalPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WALLET DIPANTAU</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{wallets.length} Wallets</div>
            </div>
          </div>

          {/* Breakdown by Blockchain */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#06b6d4" /> Alokasi per Blockchain (Mainnet)
            </span>

            {sortedChains.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sortedChains.map((c) => {
                  const percent = totalPortfolioUsd > 0 ? (c.totalUsd / totalPortfolioUsd) * 100 : 0;
                  return (
                    <div key={c.shortName} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c.color }} />
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>${c.totalUsd.toFixed(2)}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>({percent.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="progress-bar-track" style={{ height: 6 }}>
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${percent}%`, background: c.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Belum ada aset mainnet bernilai USD yang terdeteksi. Silakan jalankan Scan Semua.
              </div>
            )}
          </div>

          {/* Breakdown by Token / Coin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={16} color="#10b981" /> Holding Koin & Token Teratas
            </span>

            {sortedTokens.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {sortedTokens.map((t) => (
                  <div
                    key={t.symbol}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{t.symbol}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {t.totalAmount.toFixed(4)} {t.symbol}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#34d399' }}>${t.totalUsd.toFixed(2)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {totalPortfolioUsd > 0 ? ((t.totalUsd / totalPortfolioUsd) * 100).toFixed(1) : 0}% portofolio
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Belum ada holding koin atau token terdeteksi.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

