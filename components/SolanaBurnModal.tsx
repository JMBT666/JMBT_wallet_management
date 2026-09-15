import React, { useState, useEffect } from 'react';
import { 
  X, 
  Flame, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Coins, 
  Check, 
  Send,
  ClipboardPaste,
  Info
} from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { ParsedWalletItem } from '../types/wallet';
import { 
  getSolanaKeypairFromWallet, 
  scanSolanaTokenAccountsForBurn, 
  executeBurnAndSweepForWallet,
  SolanaWalletBurnSummary 
} from '../services/solanaBurner';
import { logger } from '../services/logger';
import { getEffectiveSolanaRpc } from '../services/rpcConfig';

interface SolanaBurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWallets: ParsedWalletItem[];
  onSuccessRefresh?: () => void;
}

export const SolanaBurnModal: React.FC<SolanaBurnModalProps> = ({
  isOpen,
  onClose,
  selectedWallets,
  onSuccessRefresh,
}) => {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [networkType, setNetworkType] = useState<'mainnet' | 'devnet'>('mainnet');
  const [burnTokens, setBurnTokens] = useState(true);
  const [sweepSol, setSweepSol] = useState(true);

  const [walletSummaries, setWalletSummaries] = useState<SolanaWalletBurnSummary[]>([]);
  const [isScanningAccounts, setIsScanningAccounts] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<{ walletLabel: string; status: string; signature?: string; error?: string; reclaimed: number }[]>([]);
  const [showConfirmStep, setShowConfirmStep] = useState(false);

  const rpcUrl = getEffectiveSolanaRpc(networkType);

  // Filter wallets that have Solana keys
  const eligibleWallets = selectedWallets.filter((w) => w.solanaAddress && w.type !== 'address');

  // Address validation
  useEffect(() => {
    const clean = destinationAddress.trim();
    if (!clean) {
      setIsAddressValid(false);
      return;
    }
    try {
      const pk = new PublicKey(clean);
      setIsAddressValid(PublicKey.isOnCurve(pk.toBuffer()));
    } catch {
      setIsAddressValid(false);
    }
  }, [destinationAddress]);

  // Initial setup when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowConfirmStep(false);
      setExecutionLogs([]);
      if (eligibleWallets.length > 0) {
        const summaries: SolanaWalletBurnSummary[] = eligibleWallets.map((w) => ({
          walletId: w.id,
          walletLabel: w.label,
          solanaAddress: w.solanaAddress!,
          keypair: getSolanaKeypairFromWallet(w),
          nativeSolBalance: 0,
          tokenAccounts: [],
          totalReclaimableRentSol: 0,
          estimatedTotalSolToTransfer: 0,
          status: 'idle',
        }));
        setWalletSummaries(summaries);
        handleScanRentAccounts(summaries);
      }
    }
  }, [isOpen, networkType]);

  if (!isOpen) return null;

  const handlePasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDestinationAddress(text.trim());
      }
    } catch {
      // ignore
    }
  };

  const handleScanRentAccounts = async (summariesToScan = walletSummaries) => {
    setIsScanningAccounts(true);
    const conn = new Connection(rpcUrl, 'confirmed');

    const updated = await Promise.all(
      summariesToScan.map(async (item) => {
        try {
          const { tokenAccounts, nativeSol } = await scanSolanaTokenAccountsForBurn(item.solanaAddress, conn);
          const reclaimableRent = tokenAccounts.length * 0.00203928;
          return {
            ...item,
            nativeSolBalance: nativeSol,
            tokenAccounts,
            totalReclaimableRentSol: reclaimableRent,
            estimatedTotalSolToTransfer: reclaimableRent + Math.max(0, nativeSol - 0.00001),
            status: 'ready' as const,
          };
        } catch {
          return { ...item, status: 'error' as const };
        }
      })
    );

    setWalletSummaries(updated);
    setIsScanningAccounts(false);
  };

  const totalReclaimableSol = walletSummaries.reduce((acc, s) => acc + s.totalReclaimableRentSol, 0);
  const totalNativeSol = walletSummaries.reduce((acc, s) => acc + s.nativeSolBalance, 0);
  const totalEstimatedTransferSol = (burnTokens ? totalReclaimableSol : 0) + (sweepSol ? Math.max(0, totalNativeSol - 0.00001 * walletSummaries.length) : 0);
  const totalTokenAccounts = walletSummaries.reduce((acc, s) => acc + s.tokenAccounts.length, 0);

  const handleStartExecution = () => {
    if (!destinationAddress.trim()) {
      alert('Mohon masukkan alamat Solana penerima (Destination Address) terlebih dahulu!');
      return;
    }
    if (!isAddressValid) {
      alert('Alamat Solana tujuan tidak valid. Pastikan format Base58 benar!');
      return;
    }
    setShowConfirmStep(true);
  };

  const handleConfirmAndRun = async () => {
    setIsExecuting(true);
    setShowConfirmStep(false);
    setExecutionLogs([]);
    const conn = new Connection(rpcUrl, 'confirmed');

    logger.info('BURN', `Memulai eksekusi Burn & Transfer untuk ${walletSummaries.length} wallet ke tujuan: ${destinationAddress}`);

    for (let i = 0; i < walletSummaries.length; i++) {
      const w = walletSummaries[i];
      setWalletSummaries((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'processing' } : item))
      );

      const result = await executeBurnAndSweepForWallet(
        w,
        destinationAddress.trim(),
        {
          burnAndCloseTokens: burnTokens,
          sweepNativeSol: sweepSol,
        },
        conn
      );

      const statusValue = result.skipped ? 'skipped' : (result.success ? 'success' : 'error');
      const statusLabel = result.skipped ? 'Dilewati' : (result.success ? 'Berhasil' : 'Gagal');

      setWalletSummaries((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? {
                ...item,
                status: statusValue,
                txSignature: result.signature,
                error: result.error,
                message: result.message,
              }
            : item
        )
      );

      setExecutionLogs((prev) => [
        ...prev,
        {
          walletLabel: w.walletLabel,
          status: statusLabel,
          signature: result.signature,
          error: result.error || result.message,
          reclaimed: result.reclaimedSol,
        },
      ]);
    }

    setIsExecuting(false);
    onSuccessRefresh?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #f43f5e, #ea580c)' }}>
              <Flame size={20} color="#ffffff" />
            </div>
            <div>
              <span className="modal-title">Solana Token Burner & Rent Reclaimer</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Bakar spam/scam tokens, tutup akun token kosong, klaim deposit rent (~0.002 SOL/akun) & sweep ke wallet tujuan.
              </p>
            </div>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Target Destination Wallet Box */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: isAddressValid ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={15} /> Masukkan Alamat Solana Tujuan (Destination Wallet):
              </label>

              <div className="category-tabs" style={{ padding: 2 }}>
                <button
                  className={`tab-btn ${networkType === 'mainnet' ? 'active' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setNetworkType('mainnet')}
                >
                  Mainnet
                </button>
                <button
                  className={`tab-btn ${networkType === 'devnet' ? 'active' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setNetworkType('devnet')}
                >
                  Devnet
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingRight: 38, fontFamily: 'var(--font-mono)' }}
                  placeholder="Contoh: 7NttK... atau alamat Phantom / Solflare utama Anda"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value.trim())}
                />
                {isAddressValid && (
                  <Check
                    size={18}
                    color="#10b981"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                  />
                )}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePasteAddress}
                title="Paste dari Clipboard"
                style={{ padding: '9px 12px' }}
              >
                <ClipboardPaste size={15} />
                <span>Paste</span>
              </button>
            </div>

            {destinationAddress && !isAddressValid && (
              <span style={{ fontSize: '0.75rem', color: '#fda4af', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> Alamat Solana Base58 tidak valid
              </span>
            )}
          </div>

          {/* Options & Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={burnTokens}
                onChange={(e) => setBurnTokens(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#10b981' }}
              />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Bakar Token & Tutup Akun</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Klaim deposit rent (~0.002 SOL per token account)
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={sweepSol}
                onChange={(e) => setSweepSol(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#10b981' }}
              />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Transfer Sisa Saldo Native SOL</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Kirim seluruh saldo SOL tersisa (dikurangi fee ~0.000005)
                </div>
              </div>
            </label>
          </div>

          {/* Aggregated Recovery Metrics */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                TOTAL ESTIMASI SOL DI-RECOVER
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                ~{totalEstimatedTransferSol.toFixed(5)} SOL
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Rent Token ({totalTokenAccounts} akun): ~{totalReclaimableSol.toFixed(4)} SOL + Native SOL: {totalNativeSol.toFixed(4)} SOL
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleScanRentAccounts()}
              disabled={isScanningAccounts || isExecuting}
            >
              <RefreshCw size={14} className={isScanningAccounts ? 'scanning-pulse' : ''} />
              <span>Scan Ulang Akun</span>
            </button>
          </div>

          {/* List of Wallets to be processed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Daftar Wallet Terpilih ({walletSummaries.length} wallet):
            </span>

            {walletSummaries.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                Tidak ada wallet dengan kunci Solana yang dipilih. Pastikan wallet memiliki kunci privat / mnemonic (bukan watch-only).
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {walletSummaries.map((w) => (
                  <div
                    key={w.walletId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700 }}>{w.walletLabel}</span>
                        <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ({w.solanaAddress.slice(0, 4)}...{w.solanaAddress.slice(-4)})
                        </span>
                        {w.tokenAccounts.length === 0 && w.nativeSolBalance <= 0.00001 && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>
                            0 Token · 0 SOL
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Native: {w.nativeSolBalance.toFixed(5)} SOL • {w.tokenAccounts.length} Token Accounts (~{(w.totalReclaimableRentSol).toFixed(4)} SOL rent)
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {w.status === 'processing' && <span style={{ color: '#38bdf8' }}>Memproses...</span>}
                      {w.status === 'success' && (
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> Berhasil
                        </span>
                      )}
                      {w.status === 'skipped' && (
                        <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }} title={w.message || 'Dilewati'}>
                          <span>⚪ Dilewati</span>
                        </span>
                      )}
                      {w.status === 'error' && (
                        <span style={{ color: '#fda4af', display: 'flex', alignItems: 'center', gap: 4 }} title={w.error}>
                          <AlertCircle size={14} /> Error
                        </span>
                      )}
                      {w.txSignature && (
                        <a
                          href={`https://solscan.io/tx/${w.txSignature}${networkType === 'devnet' ? '?cluster=devnet' : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="copy-btn"
                          title="Lihat di Solscan"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gas fee notice */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} color="#06b6d4" /> Setiap transaksi Solana membutuhkan saldo gas fee minimal ~0.000005 SOL di wallet pengirim.
          </div>

          {/* In-App Confirmation Banner */}
          {showConfirmStep && (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                animation: 'slideUp 0.2s ease',
              }}
            >
              <div style={{ fontWeight: 800, color: '#fda4af', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} /> Konfirmasi Eksekusi Burn & Sweep:
              </div>
              <div style={{ fontSize: '0.82rem', color: '#fecdd3', lineHeight: 1.5 }}>
                • Jaringan: <strong>{networkType.toUpperCase()}</strong><br />
                • Total Wallet: <strong>{walletSummaries.length} wallet</strong><br />
                • Alamat Penerima: <strong className="font-mono">{destinationAddress}</strong><br />
                • Estimasi SOL Ditransfer: <strong>~{totalEstimatedTransferSol.toFixed(4)} SOL</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowConfirmStep(false)}>
                  Batal
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #ea580c)', border: 'none' }}
                  onClick={handleConfirmAndRun}
                >
                  🚀 Ya, Jalankan Transaksi Sekarang
                </button>
              </div>
            </div>
          )}

          {/* Execution logs */}
          {executionLogs.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                fontSize: '0.78rem',
                maxHeight: 120,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Log Eksekusi:</div>
              {executionLogs.map((log, i) => (
                <div 
                  key={i} 
                  style={{ 
                    color: log.status === 'Berhasil' ? '#34d399' : (log.status === 'Dilewati' ? '#94a3b8' : '#fda4af') 
                  }}
                >
                  • {log.walletLabel}: <strong>{log.status}</strong> {log.signature ? `(TX: ${log.signature.slice(0, 10)}...)` : (log.error ? `- ${log.error}` : '')}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isExecuting}>
            Tutup
          </button>
          {!showConfirmStep && (
            <button
              className="btn btn-danger"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ea580c)' }}
              onClick={handleStartExecution}
              disabled={isExecuting || walletSummaries.length === 0}
            >
              <Flame size={16} />
              <span>
                {isExecuting ? 'Memproses Transaksi...' : `Eksekusi Burn & Transfer (${walletSummaries.length} Wallet)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

