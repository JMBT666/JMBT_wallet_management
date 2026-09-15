import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  QrCode, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Coins, 
  Key, 
  Layers,
  ArrowUpRight,
  Image,
  RefreshCw,
  Send
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import { ParsedWalletItem } from '../types/wallet';
import { SUPPORTED_CHAINS } from '../config/chains';
import { getBlockchairAddressUrl, getBlockchairSearchUrl } from '../services/blockchairService';

interface WalletDetailModalProps {
  wallet: ParsedWalletItem | null;
  onClose: () => void;
  onScanSingle: (wallet: ParsedWalletItem) => void;
  isScanning: boolean;
  onOpenTransfer?: (wallet: ParsedWalletItem) => void;
}

export const WalletDetailModal: React.FC<WalletDetailModalProps> = ({
  wallet,
  onClose,
  onScanSingle,
  isScanning,
  onOpenTransfer,
}) => {
  const [activeTab, setActiveTab] = useState<'chains' | 'nfts' | 'derived' | 'security'>('chains');
  const [chainCategoryFilter, setChainCategoryFilter] = useState<'all' | 'mainnet' | 'testnet'>('all');
  const [showRawSecret, setShowRawSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [selectedQrAddress, setSelectedQrAddress] = useState<string>('');

  const allNfts = wallet ? Object.values(wallet.chainAssets || {}).flatMap((a) => a.nfts || []) : [];
  const totalNftValue = wallet ? (wallet.totalNftValueUsd || allNfts.reduce((acc, n) => acc + n.estimatedValueUsd, 0)) : 0;

  useEffect(() => {
    if (wallet) {
      const initialAddress = wallet.evmAddress || wallet.solanaAddress || wallet.tronAddress || '';
      setSelectedQrAddress(initialAddress);
      if (initialAddress) {
        QRCodeLib.toDataURL(initialAddress, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
          .then(setQrCodeDataUrl)
          .catch(() => {});
      }
    }
  }, [wallet]);

  if (!wallet) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectQr = (address: string) => {
    setSelectedQrAddress(address);
    QRCodeLib.toDataURL(address, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrCodeDataUrl)
      .catch(() => {});
  };

  const filteredChains = SUPPORTED_CHAINS.filter((c) => {
    if (chainCategoryFilter === 'mainnet') return c.category === 'mainnet';
    if (chainCategoryFilter === 'testnet') return c.category === 'testnet';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{wallet.label}</span>
            <span className={`badge badge-${wallet.type}`}>
              {wallet.type === 'mnemonic' ? 'Mnemonic' : wallet.type === 'privateKey' ? 'Private Key' : 'Address'}
            </span>
            <span className="badge badge-funded">
              ${(wallet.totalMainnetValueUsd || 0).toFixed(2)} USD
            </span>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 24px', gap: 16 }}>
          <button
            className={`tab-btn ${activeTab === 'chains' ? 'active' : ''}`}
            style={{ borderRadius: 0, borderBottom: activeTab === 'chains' ? '2px solid var(--accent-emerald)' : 'none', padding: '12px 6px' }}
            onClick={() => setActiveTab('chains')}
          >
            <Coins size={15} style={{ marginRight: 6 }} /> Semua Jaringan & Token
          </button>

          <button
            className={`tab-btn ${activeTab === 'nfts' ? 'active' : ''}`}
            style={{ borderRadius: 0, borderBottom: activeTab === 'nfts' ? '2px solid #a855f7' : 'none', padding: '12px 6px' }}
            onClick={() => setActiveTab('nfts')}
          >
            <Image size={15} style={{ marginRight: 6, color: '#c084fc' }} /> Koleksi NFT ({allNfts.length})
          </button>

          {wallet.derivedAccounts && wallet.derivedAccounts.length > 0 && (
            <button
              className={`tab-btn ${activeTab === 'derived' ? 'active' : ''}`}
              style={{ borderRadius: 0, borderBottom: activeTab === 'derived' ? '2px solid var(--accent-emerald)' : 'none', padding: '12px 6px' }}
              onClick={() => setActiveTab('derived')}
            >
              <Layers size={15} style={{ marginRight: 6 }} /> Derived Accounts ({wallet.derivedAccounts.length})
            </button>
          )}

          <button
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            style={{ borderRadius: 0, borderBottom: activeTab === 'security' ? '2px solid var(--accent-emerald)' : 'none', padding: '12px 6px' }}
            onClick={() => setActiveTab('security')}
          >
            <Key size={15} style={{ marginRight: 6 }} /> QR Code & Kunci Rahasia
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {activeTab === 'chains' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Blockchair Quick Explorer & Search Banner */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem' }}>🔍</span>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>Verifikasi Langsung di Blockchair Explorer</strong>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                      Gunakan Blockchair untuk cek saldo independen lintas 20+ jaringan blockchain.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {wallet.solanaAddress && (
                    <a
                      href={getBlockchairAddressUrl('solana', wallet.solanaAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#14F195' }}
                      title="Buka akun Solana di Blockchair"
                    >
                      <span>Blockchair Solana</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {wallet.evmAddress && (
                    <a
                      href={getBlockchairSearchUrl(wallet.evmAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#627EEA' }}
                      title="Cari alamat ini di seluruh blockchain via Blockchair"
                    >
                      <span>Blockchair Multi-Chain Search</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Filter category pills */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div className="category-tabs">
                  <button
                    className={`tab-btn ${chainCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setChainCategoryFilter('all')}
                  >
                    Semua ({SUPPORTED_CHAINS.length})
                  </button>
                  <button
                    className={`tab-btn ${chainCategoryFilter === 'mainnet' ? 'active' : ''}`}
                    onClick={() => setChainCategoryFilter('mainnet')}
                  >
                    🌐 Mainnets
                  </button>
                  <button
                    className={`tab-btn ${chainCategoryFilter === 'testnet' ? 'active' : ''}`}
                    onClick={() => setChainCategoryFilter('testnet')}
                  >
                    🧪 Testnets
                  </button>
                </div>

                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => onScanSingle(wallet)}
                  disabled={isScanning || wallet.scanStatus === 'scanning'}
                >
                  Scan Ulang Jaringan
                </button>
              </div>

              {/* Grid of chains */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {filteredChains.map((chain) => {
                  const asset = wallet.chainAssets[chain.id];
                  const hasBal = asset?.hasBalance;
                  const isScanned = !!asset && asset.status === 'success';

                  return (
                    <div
                      key={chain.id}
                      style={{
                        background: hasBal ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                        border: hasBal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: chain.color,
                            }}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{chain.name}</span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-full)',
                              background: chain.category === 'mainnet' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: chain.category === 'mainnet' ? '#34d399' : '#93c5fd',
                            }}
                          >
                            {chain.category}
                          </span>
                        </div>

                        {asset?.explorerUrl && (
                          <a
                            href={asset.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="copy-btn"
                            title="Buka Explorer"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>

                      {/* Native balance */}
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {chain.nativeCurrency.symbol}:
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                            {asset ? asset.nativeBalance : '—'} {chain.nativeCurrency.symbol}
                          </span>
                          {chain.category === 'mainnet' && asset && (
                            <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                              ≈ ${(asset.nativeValueUsd || 0).toFixed(2)} USD
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tokens list if any */}
                      {asset?.tokens && asset.tokens.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            TOKENS ({asset.tokens.length}):
                          </span>
                          {asset.tokens.map((tok, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.8rem',
                                background: 'rgba(0, 0, 0, 0.2)',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{tok.symbol}</span>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{tok.balance}</span>
                                {tok.valueUsd > 0 && (
                                  <span style={{ color: '#34d399', marginLeft: 6, fontSize: '0.72rem' }}>
                                    (${tok.valueUsd.toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isScanned && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Belum dipindai
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NFT Collection Tab */}
          {activeTab === 'nfts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* NFT Overview Header */}
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Nilai Estimasi Portofolio NFT</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>
                    ${totalNftValue.toFixed(2)} USD
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#e9d5ff', padding: '6px 12px', fontSize: '0.85rem' }}>
                    🖼️ {allNfts.length} Item Koleksi Terdeteksi
                  </span>
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => onScanSingle(wallet)}
                    disabled={isScanning}
                  >
                    <RefreshCw size={13} className={isScanning ? 'scanning-pulse' : ''} />
                    <span>Scan Ulang NFT</span>
                  </button>
                </div>
              </div>

              {/* NFT Grid */}
              {allNfts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Image size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    Belum ada aset NFT terdeteksi
                  </p>
                  <p style={{ fontSize: '0.8rem', maxWidth: 400, margin: '6px auto 0' }}>
                    Pastikan wallet telah dipindai (Scan) pada jaringan yang didukung (Ethereum, Base, Polygon, Arbitrum, Optimism, Solana).
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: 14,
                    maxHeight: 450,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {allNfts.map((nft, idx) => (
                    <div
                      key={`${nft.contractAddress}_${nft.id}_${idx}`}
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.15s, border-color 0.15s',
                      }}
                    >
                      {/* Image Preview */}
                      <div style={{ width: '100%', height: 160, background: '#0f172a', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {nft.imageUrl ? (
                          <img
                            src={nft.imageUrl}
                            alt={nft.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <Image size={32} style={{ opacity: 0.5 }} />
                            <span style={{ fontSize: '0.7rem' }}>{nft.standard}</span>
                          </div>
                        )}

                        {/* Chain Badge overlay */}
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#38bdf8',
                            backdropFilter: 'blur(4px)',
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          {nft.chainName}
                        </span>
                      </div>

                      {/* Content Details */}
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {nft.collectionName}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nft.name}>
                            {nft.name}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 8, marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Floor / Nilai:</span>
                            <span style={{ fontWeight: 700, color: nft.estimatedValueUsd > 0 ? '#34d399' : 'var(--text-secondary)' }}>
                              {nft.estimatedValueUsd > 0
                                ? `$${nft.estimatedValueUsd.toFixed(2)}`
                                : (nft.floorPriceNative ? `${nft.floorPriceNative.toFixed(4)} ${nft.chainId.includes('solana') ? 'SOL' : 'ETH'}` : 'Koleksi Unik')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <span className="badge badge-empty" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                              {nft.standard}
                            </span>
                            <a
                              href={nft.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <span>Explorer</span>
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Derived Accounts Tab */}
          {activeTab === 'derived' && wallet.derivedAccounts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Daftar akun turunan (derivation path) dari Mnemonic seed phrase ini:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wallet.derivedAccounts.map((acc) => (
                  <div
                    key={acc.index}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          Account #{acc.index}
                        </span>
                        <span className="badge" style={{ background: 'rgba(98, 126, 234, 0.15)', color: '#818cf8', fontSize: '0.68rem' }}>
                          EVM: {acc.path}
                        </span>
                        <span className="badge" style={{ background: 'rgba(20, 241, 149, 0.15)', color: '#34d399', fontSize: '0.68rem' }}>
                          Solana: m/44'/501'/{acc.index}'/0'
                        </span>
                        <span className="badge" style={{ background: 'rgba(255, 0, 19, 0.15)', color: '#ff4d4d', fontSize: '0.68rem' }}>
                          TRON: m/44'/195'/0'/0/{acc.index}
                        </span>
                        <span className="badge" style={{ background: 'rgba(247, 147, 26, 0.15)', color: '#f59e0b', fontSize: '0.68rem' }}>
                          BTC: m/84'/0'/0'/0/{acc.index}
                        </span>
                        <span className="badge" style={{ background: 'rgba(52, 93, 157, 0.15)', color: '#60a5fa', fontSize: '0.68rem' }}>
                          LTC: m/84'/2'/0'/0/{acc.index}
                        </span>
                        <span className="badge" style={{ background: 'rgba(161, 161, 170, 0.15)', color: '#a1a1aa', fontSize: '0.68rem' }}>
                          XRP: m/44'/144'/0'/0/{acc.index}
                        </span>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                        onClick={() => handleSelectQr(acc.evmAddress || acc.solanaAddress || acc.tronAddress || acc.btcAddress || acc.ltcAddress || acc.xrpAddress || '')}
                      >
                        <QrCode size={12} /> QR Code
                      </button>
                    </div>

                    {acc.evmAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>EVM Address:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.evmAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.evmAddress!, `d_evm_${acc.index}`)}
                          >
                            {copiedKey === `d_evm_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.solanaAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Solana Address:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.solanaAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.solanaAddress!, `d_sol_${acc.index}`)}
                          >
                            {copiedKey === `d_sol_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.tronAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#ff4d4d' }}>TRON Address:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.tronAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.tronAddress!, `d_tron_${acc.index}`)}
                          >
                            {copiedKey === `d_tron_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.btcAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#f59e0b' }}>Bitcoin (SegWit):</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.btcAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.btcAddress!, `d_btc_${acc.index}`)}
                          >
                            {copiedKey === `d_btc_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.ltcAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#60a5fa' }}>Litecoin (SegWit):</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.ltcAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.ltcAddress!, `d_ltc_${acc.index}`)}
                          >
                            {copiedKey === `d_ltc_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.xrpAddress && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#a1a1aa' }}>Ripple XRP:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono">{acc.xrpAddress}</span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.xrpAddress!, `d_xrp_${acc.index}`)}
                          >
                            {copiedKey === `d_xrp_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {acc.evmPrivateKey && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#fb7185' }}>EVM Private Key:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="font-mono" style={{ color: '#fecdd3' }}>
                            {showRawSecret ? acc.evmPrivateKey : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                          </span>
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(acc.evmPrivateKey!, `d_pk_${acc.index}`)}
                          >
                            {copiedKey === `d_pk_${acc.index}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security & QR Code Tab */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* QR Code Section */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                }}
              >
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Address QR Code"
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: 'var(--radius-md)',
                      background: '#ffffff',
                      padding: 8,
                    }}
                  />
                ) : (
                  <div style={{ width: 160, height: 160, background: '#1e293b', borderRadius: 'var(--radius-md)' }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Address QR Code Scanner</span>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Scan QR code di atas menggunakan aplikasi mobile wallet (Metamask, TrustWallet, Phantom) untuk transfer atau kirim aset.
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {wallet.evmAddress && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === wallet.evmAddress ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr(wallet.evmAddress!)}
                      >
                        EVM QR ({wallet.evmAddress.slice(0, 6)}...)
                      </button>
                    )}
                    {wallet.solanaAddress && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === wallet.solanaAddress ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr(wallet.solanaAddress!)}
                      >
                        Solana QR ({wallet.solanaAddress.slice(0, 6)}...)
                      </button>
                    )}
                    {wallet.tronAddress && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === wallet.tronAddress ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr(wallet.tronAddress!)}
                      >
                        TRON QR ({wallet.tronAddress.slice(0, 6)}...)
                      </button>
                    )}
                    {(wallet.btcAddress || wallet.btcLegacyAddress) && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === (wallet.btcAddress || wallet.btcLegacyAddress) ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr((wallet.btcAddress || wallet.btcLegacyAddress)!)}
                      >
                        BTC QR ({(wallet.btcAddress || wallet.btcLegacyAddress)!.slice(0, 6)}...)
                      </button>
                    )}
                    {(wallet.ltcAddress || wallet.ltcLegacyAddress) && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === (wallet.ltcAddress || wallet.ltcLegacyAddress) ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr((wallet.ltcAddress || wallet.ltcLegacyAddress)!)}
                      >
                        LTC QR ({(wallet.ltcAddress || wallet.ltcLegacyAddress)!.slice(0, 6)}...)
                      </button>
                    )}
                    {wallet.xrpAddress && (
                      <button
                        className={`btn btn-sm ${selectedQrAddress === wallet.xrpAddress ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectQr(wallet.xrpAddress!)}
                      >
                        XRP QR ({wallet.xrpAddress.slice(0, 6)}...)
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                    {selectedQrAddress}
                  </div>
                </div>
              </div>

              {/* Raw Secret Reveal */}
              {wallet.type !== 'address' && (
                <div
                  style={{
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    background: 'rgba(244, 63, 94, 0.05)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fb7185', fontWeight: 700 }}>
                      <ShieldAlert size={18} />
                      <span>{wallet.type === 'mnemonic' ? 'Mnemonic Seed Phrase' : 'Private Key'}</span>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowRawSecret(!showRawSecret)}
                    >
                      {showRawSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showRawSecret ? 'Sembunyikan' : 'Tampilkan Kunci'}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      color: showRawSecret ? '#fecdd3' : 'var(--text-muted)',
                      wordBreak: 'break-all',
                      userSelect: showRawSecret ? 'all' : 'none',
                    }}
                  >
                    {showRawSecret ? wallet.rawSecret : wallet.maskedSecret}
                  </div>

                  {showRawSecret && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(wallet.rawSecret, 'raw_secret_modal')}
                      >
                        {copiedKey === 'raw_secret_modal' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        <span>Salin Kunci</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {wallet && wallet.type !== 'address' && onOpenTransfer ? (
            <button
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#000',
                fontWeight: 700,
                border: 'none',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
              }}
              onClick={() => onOpenTransfer(wallet)}
              title="Transfer seluruh aset dari wallet ini ke wallet tujuan"
            >
              <Send size={14} color="#000" />
              <span>Transfer Semua Aset Wallet Ini</span>
            </button>
          ) : (
            <div />
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

