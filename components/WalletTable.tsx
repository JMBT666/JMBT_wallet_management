import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  Eye, 
  EyeOff,
  Coins
} from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { maskAddress } from '../services/derivation';
import { getBlockchairAddressUrl, getBlockchairSearchUrl } from '../services/blockchairService';

interface WalletTableProps {
  wallets: ParsedWalletItem[];
  isScanning: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (walletId: string) => void;
  onToggleSelectAll: () => void;
  onScanSingle: (wallet: ParsedWalletItem) => void;
  onDelete: (walletId: string) => void;
  onViewDetails: (wallet: ParsedWalletItem) => void;
}

export const WalletTable: React.FC<WalletTableProps> = ({
  wallets,
  isScanning,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onScanSingle,
  onDelete,
  onViewDetails,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleRevealSecret = (walletId: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [walletId]: !prev[walletId],
    }));
  };

  const isAllSelected = wallets.length > 0 && wallets.every((w) => selectedIds.has(w.id));

  return (
    <div className="glass-card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0, 0, 0, 0.3)' }}>
            <th style={{ padding: '14px 16px', width: 40 }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onToggleSelectAll}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10b981' }}
                title="Pilih Semua"
              />
            </th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>#</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Label / Tipe</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Address (EVM / Solana / TRON)</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Kunci / Secret</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Saldo Mainnet (USD)</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Jaringan Aktif</th>
            <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((wallet, index) => {
            const fundedChains = Object.values(wallet.chainAssets || {}).filter((a) => a.hasBalance);
            const isWalletScanning = wallet.scanStatus === 'scanning';
            const isRevealed = !!revealedSecrets[wallet.id];
            const isSelected = selectedIds.has(wallet.id);

            return (
              <tr
                key={wallet.id}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(16, 185, 129, 0.08)' : index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Checkbox */}
                <td style={{ padding: '14px 16px' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(wallet.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10b981' }}
                  />
                </td>

                {/* Index */}
                <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {index + 1}
                </td>

                {/* Label & Type */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{wallet.label}</span>
                    <span className={`badge badge-${wallet.type}`} style={{ alignSelf: 'flex-start', fontSize: '0.65rem' }}>
                      {wallet.type}
                    </span>
                  </div>
                </td>

                {/* Addresses */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {wallet.evmAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#627EEA', fontWeight: 700 }}>EVM:</span>
                        <span className="font-mono">{maskAddress(wallet.evmAddress)}</span>
                        <button
                          className="copy-btn"
                          onClick={() => handleCopy(wallet.evmAddress!, `t_evm_${wallet.id}`)}
                          title="Copy EVM Address"
                        >
                          {copiedKey === `t_evm_${wallet.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                    {wallet.solanaAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#14F195', fontWeight: 700 }}>SOL:</span>
                        <span className="font-mono">{maskAddress(wallet.solanaAddress)}</span>
                        <button
                          className="copy-btn"
                          onClick={() => handleCopy(wallet.solanaAddress!, `t_sol_${wallet.id}`)}
                          title="Copy SOL Address"
                        >
                          {copiedKey === `t_sol_${wallet.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                    {wallet.tronAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#FF0013', fontWeight: 700 }}>TRX:</span>
                        <span className="font-mono">{maskAddress(wallet.tronAddress)}</span>
                        <button
                          className="copy-btn"
                          onClick={() => handleCopy(wallet.tronAddress!, `t_tron_${wallet.id}`)}
                          title="Copy TRON Address"
                        >
                          {copiedKey === `t_tron_${wallet.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                </td>

                {/* Secret Key */}
                <td style={{ padding: '14px 16px' }}>
                  {wallet.type !== 'address' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: isRevealed ? '#fecdd3' : 'var(--text-muted)' }}>
                        {isRevealed
                          ? (wallet.rawSecret.length > 25 ? wallet.rawSecret.slice(0, 22) + '...' : wallet.rawSecret)
                          : wallet.maskedSecret}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => toggleRevealSecret(wallet.id)}
                        title={isRevealed ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        className="copy-btn"
                        onClick={() => handleCopy(wallet.rawSecret, `t_sec_${wallet.id}`)}
                        title="Copy Secret"
                      >
                        {copiedKey === `t_sec_${wallet.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>— Watch Only —</span>
                  )}
                </td>

                {/* Balance USD & Status */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: (wallet.totalMainnetValueUsd || 0) > 0 ? '#34d399' : 'var(--text-muted)' }}>
                      ${(wallet.totalMainnetValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    {wallet.scanStatus === 'error' && (
                      <span style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: 700 }} title={wallet.error}>
                        ⚠️ Gagal Scan ({wallet.error || 'Perlu Ulang'})
                      </span>
                    )}
                    {wallet.scanStatus === 'idle' && (
                      <span style={{ fontSize: '0.68rem', color: '#eab308', fontWeight: 600 }}>
                        ⏳ Belum Dicek
                      </span>
                    )}
                    {wallet.scanStatus === 'done' && !wallet.hasAnyBalance && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        ⭕ 0 Fund ($0.00)
                      </span>
                    )}
                  </div>
                </td>

                {/* Active Chains */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 260 }}>
                    {fundedChains.length > 0 ? (
                      fundedChains.map((asset) => (
                        <span
                          key={asset.chainId}
                          className="asset-chip has-balance"
                          style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                        >
                          {asset.chainShortName}: {asset.nativeBalance}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {wallet.scanStatus === 'done' ? '⭕ 0 Saldo di Semua Chain' : wallet.scanStatus === 'error' ? '⚠️ Gagal di Beberapa Chain' : '⏳ Belum Scan'}
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <a
                      href={
                        wallet.solanaAddress
                          ? getBlockchairAddressUrl('solana', wallet.solanaAddress)
                          : getBlockchairSearchUrl(wallet.evmAddress || '')
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', color: '#38bdf8' }}
                      title="Cek di Blockchair Explorer"
                    >
                      <span style={{ fontSize: '0.72rem' }}>Blockchair</span>
                      <ExternalLink size={11} />
                    </a>

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => onViewDetails(wallet)}
                      title="Lihat Detail"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      className="btn btn-accent btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => onScanSingle(wallet)}
                      disabled={isScanning || isWalletScanning}
                      title="Scan Ulang"
                    >
                      <RefreshCw size={13} className={isWalletScanning ? 'scanning-pulse' : ''} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      style={{ width: 28, height: 28 }}
                      onClick={() => onDelete(wallet.id)}
                      title="Hapus"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

