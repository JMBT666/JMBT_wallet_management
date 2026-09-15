import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Key, 
  FileText, 
  ShieldAlert, 
  Coins,
  Edit2,
  Image
} from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { maskAddress } from '../services/derivation';
import { getBlockchairAddressUrl, getBlockchairSearchUrl } from '../services/blockchairService';

interface WalletCardProps {
  wallet: ParsedWalletItem;
  isScanning: boolean;
  isSelected: boolean;
  onToggleSelect: (walletId: string) => void;
  onScanSingle: (wallet: ParsedWalletItem) => void;
  onDelete: (walletId: string) => void;
  onViewDetails: (wallet: ParsedWalletItem) => void;
  onUpdateLabel: (walletId: string, newLabel: string) => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  isScanning,
  isSelected,
  onToggleSelect,
  onScanSingle,
  onDelete,
  onViewDetails,
  onUpdateLabel,
}) => {
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(wallet.label);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveLabel = () => {
    if (labelInput.trim() && labelInput !== wallet.label) {
      onUpdateLabel(wallet.id, labelInput.trim());
    }
    setIsEditingLabel(false);
  };

  const fundedChains = Object.values(wallet.chainAssets || {}).filter((a) => a.hasBalance);
  const isWalletScanning = wallet.scanStatus === 'scanning';

  return (
    <div
      className="glass-card wallet-card"
      style={{
        borderColor: isSelected ? 'var(--accent-emerald)' : undefined,
        background: isSelected ? 'rgba(16, 185, 129, 0.05)' : undefined,
      }}
    >
      {/* Header */}
      <div className="wallet-card-header">
        <div className="wallet-title-area">
          {/* Checkbox for batch select */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(wallet.id)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
            title="Pilih wallet ini"
          />

          {isEditingLabel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                className="search-input"
                style={{ padding: '4px 8px', fontSize: '0.9rem', width: 180 }}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleSaveLabel}>
                Simpan
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="wallet-label">{wallet.label}</span>
              <button
                className="copy-btn"
                style={{ padding: 2 }}
                onClick={() => setIsEditingLabel(true)}
                title="Edit Label"
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}

          {/* Type Badge */}
          <span className={`badge badge-${wallet.type}`}>
            {wallet.type === 'mnemonic' && <Key size={11} />}
            {wallet.type === 'privateKey' && <Key size={11} />}
            {wallet.type === 'address' && <FileText size={11} />}
            {wallet.type === 'mnemonic' ? 'Mnemonic Phrase' : wallet.type === 'privateKey' ? 'Private Key' : 'Watch Address'}
          </span>

          {/* Scan & Fund Status Badges */}
          {wallet.scanStatus === 'error' && (
            <span className="badge badge-danger" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', border: '1px solid #f43f5e', fontWeight: 700 }} title={wallet.error}>
              ⚠️ Belum Lengkap / Error (Perlu Scan Ulang)
            </span>
          )}

          {wallet.scanStatus === 'idle' && (
            <span className="badge badge-warning" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid #eab308', fontWeight: 600 }}>
              ⏳ Belum Dicek
            </span>
          )}

          {wallet.scanStatus === 'scanning' && (
            <span className="badge badge-accent" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 700 }}>
              🔄 Sedang Dicek...
            </span>
          )}

          {wallet.scanStatus === 'done' && wallet.hasAnyBalance && (
            <span className="badge badge-funded">
              <Coins size={11} /> {fundedChains.length} Chain Ada Saldo (${wallet.totalMainnetValueUsd.toFixed(2)})
            </span>
          )}

          {wallet.totalNftCount && wallet.totalNftCount > 0 ? (
            <span
              className="badge"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Aset NFT terdeteksi"
            >
              <Image size={11} /> {wallet.totalNftCount} NFT ({wallet.totalNftValueUsd && wallet.totalNftValueUsd > 0 ? `$${wallet.totalNftValueUsd.toFixed(2)}` : 'Koleksi'})
            </span>
          ) : null}

          {wallet.scanStatus === 'done' && !wallet.hasAnyBalance && (
            <span className="badge badge-empty" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid var(--border-subtle)' }}>
              ⭕ 0 Fund ($0.00)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="wallet-card-actions">
          {/* Blockchair 1-Click Verification */}
          <a
            href={
              wallet.solanaAddress
                ? getBlockchairAddressUrl('solana', wallet.solanaAddress)
                : getBlockchairSearchUrl(wallet.evmAddress || '')
            }
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8' }}
            title="Buka langsung di Blockchair Explorer"
          >
            <span>Blockchair</span>
            <ExternalLink size={12} />
          </a>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onViewDetails(wallet)}
            title="Lihat rincian lengkap token dan jaringan"
          >
            <span>Detail Aset</span>
            <ExternalLink size={13} />
          </button>

          <button
            className="btn btn-accent btn-sm"
            onClick={() => onScanSingle(wallet)}
            disabled={isScanning || isWalletScanning}
            title="Scan ulang wallet ini"
          >
            <RefreshCw size={14} className={isWalletScanning ? 'scanning-pulse' : ''} />
            <span>{isWalletScanning ? 'Scanning...' : 'Scan'}</span>
          </button>

          {/* Delete Button */}
          <button
            className="btn btn-danger btn-icon btn-sm"
            onClick={() => onDelete(wallet.id)}
            title="Hapus wallet ini"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Address & Secret Row */}
      <div className="wallet-addresses-box">
        {/* EVM Address */}
        {wallet.evmAddress && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#818cf8' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#627EEA' }}></span>
                EVM (ETH / BSC / POL / BASE / ARB)
              </div>
              <div className="address-val" title={wallet.evmAddress}>
                {maskAddress(wallet.evmAddress)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy(wallet.evmAddress!, `evm_${wallet.id}`)}
              title="Copy EVM Address"
            >
              {copiedKey === `evm_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Solana Address */}
        {wallet.solanaAddress && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#34d399' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#14F195' }}></span>
                Solana (SOL Mainnet & Devnet)
              </div>
              <div className="address-val" title={wallet.solanaAddress}>
                {maskAddress(wallet.solanaAddress)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy(wallet.solanaAddress!, `sol_${wallet.id}`)}
              title="Copy Solana Address"
            >
              {copiedKey === `sol_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* TRON Address */}
        {wallet.tronAddress && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ff4d4d' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF0013' }}></span>
                TRON (TRX & TRC-20 USDT)
              </div>
              <div className="address-val" title={wallet.tronAddress}>
                {maskAddress(wallet.tronAddress)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy(wallet.tronAddress!, `tron_${wallet.id}`)}
              title="Copy TRON Address"
            >
              {copiedKey === `tron_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Bitcoin Address */}
        {(wallet.btcAddress || wallet.btcLegacyAddress) && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F7931A' }}></span>
                Bitcoin (BTC {wallet.btcAddress ? 'Native SegWit' : 'Legacy'})
              </div>
              <div className="address-val" title={wallet.btcAddress || wallet.btcLegacyAddress}>
                {maskAddress((wallet.btcAddress || wallet.btcLegacyAddress)!)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy((wallet.btcAddress || wallet.btcLegacyAddress)!, `btc_${wallet.id}`)}
              title="Copy Bitcoin Address"
            >
              {copiedKey === `btc_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Litecoin Address */}
        {(wallet.ltcAddress || wallet.ltcLegacyAddress) && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#60a5fa' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#345D9D' }}></span>
                Litecoin (LTC {wallet.ltcAddress ? 'SegWit' : 'Legacy'})
              </div>
              <div className="address-val" title={wallet.ltcAddress || wallet.ltcLegacyAddress}>
                {maskAddress((wallet.ltcAddress || wallet.ltcLegacyAddress)!)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy((wallet.ltcAddress || wallet.ltcLegacyAddress)!, `ltc_${wallet.id}`)}
              title="Copy Litecoin Address"
            >
              {copiedKey === `ltc_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Ripple XRP Address */}
        {wallet.xrpAddress && (
          <div className="address-item">
            <div>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a1a1aa' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e4e4e7' }}></span>
                Ripple (XRP Ledger)
              </div>
              <div className="address-val" title={wallet.xrpAddress}>
                {maskAddress(wallet.xrpAddress)}
              </div>
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy(wallet.xrpAddress!, `xrp_${wallet.id}`)}
              title="Copy XRP Address"
            >
              {copiedKey === `xrp_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Secret / Key Masked */}
        {wallet.type !== 'address' && (
          <div className="address-item" style={{ gridColumn: '1 / -1' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="address-label" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fb7185' }}>
                <ShieldAlert size={12} /> {wallet.type === 'mnemonic' ? 'Seed Phrase' : 'Private Key'} (Lokal)
              </div>
              <div className="address-val" style={{ color: showSecret ? '#fecdd3' : 'var(--text-muted)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {showSecret ? wallet.rawSecret : wallet.maskedSecret}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className="copy-btn"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? 'Sembunyikan Secret' : 'Tampilkan Secret'}
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="copy-btn"
                onClick={() => handleCopy(wallet.rawSecret, `sec_${wallet.id}`)}
                title="Copy Secret"
              >
                {copiedKey === `sec_${wallet.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Balances Summary */}
      <div className="wallet-assets-preview">
        <div className="assets-preview-header">
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            SALDO TERDETEKSI:
          </span>
          <span className="assets-total-val">
            ${(wallet.totalMainnetValueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="asset-chain-chips">
          {fundedChains.length > 0 ? (
            fundedChains.map((asset) => {
              const isTestnet = asset.category === 'testnet';
              return (
                <div
                  key={asset.chainId}
                  className={`asset-chip has-balance ${isTestnet ? 'is-testnet' : ''}`}
                >
                  <span style={{ fontWeight: 700 }}>{asset.chainShortName}:</span>
                  <span>{asset.nativeBalance}</span>
                  {!isTestnet && asset.totalValueUsd > 0 && (
                    <span style={{ color: '#34d399', fontSize: '0.75rem' }}>
                      (${asset.totalValueUsd.toFixed(2)})
                    </span>
                  )}
                  {asset.tokens.length > 0 && (
                    <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                      +{asset.tokens.length} tok
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {wallet.scanStatus === 'done'
                ? 'Tidak ada saldo terdeteksi di 18+ jaringan (EVM & Solana).'
                : 'Klik "Scan" untuk memeriksa saldo di 18+ blockchain (EVM & Solana).'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

