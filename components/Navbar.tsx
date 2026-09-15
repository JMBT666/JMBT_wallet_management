import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Upload, 
  RefreshCw, 
  Download, 
  Trash2, 
  ShieldCheck, 
  ChevronDown,
  PieChart,
  Terminal,
  Server,
  Send
} from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { exportWalletsToCsv, exportWalletsToJson, exportWalletsToTxt } from '../services/exportService';
import { logger } from '../services/logger';

interface NavbarProps {
  wallets: ParsedWalletItem[];
  isScanning: boolean;
  isLogsOpen: boolean;
  onToggleLogs: () => void;
  onOpenImport: () => void;
  onScanAll: () => void;
  onClearAll: () => void;
  onOpenAnalytics: () => void;
  onOpenRpcSettings: () => void;
  onOpenTransferAll: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  wallets,
  isScanning,
  isLogsOpen,
  onToggleLogs,
  onOpenImport,
  onScanAll,
  onClearAll,
  onOpenAnalytics,
  onOpenRpcSettings,
  onOpenTransferAll,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const updateCounts = () => {
      const errs = logger.getLogs().filter((l) => l.level === 'error').length;
      setErrorCount(errs);
    };
    updateCounts();
    const unsub = logger.subscribe(updateCounts);
    return () => unsub();
  }, []);

  const handleExport = (format: 'csv' | 'json' | 'txt', includeSecrets: boolean) => {
    setShowExportMenu(false);
    if (includeSecrets) {
      const confirmWarning = window.confirm(
        'PERINGATAN KEAMANAN:\nAnda akan mengekspor file yang berisi Private Key / Mnemonic Phrase mentah.\n\nPastikan file disimpan di tempat yang aman. Lanjutkan?'
      );
      if (!confirmWarning) return;
    }

    if (format === 'csv') exportWalletsToCsv(wallets, includeSecrets);
    else if (format === 'json') exportWalletsToJson(wallets, includeSecrets);
    else if (format === 'txt') exportWalletsToTxt(wallets, includeSecrets);
  };

  return (
    <nav className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <Wallet size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="brand-title">JMBT Web3 Wallet</span>
            <span className="brand-badge">MANAGEMENT v2.0</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={13} color="#10b981" /> 100% Client-Side Privacy
          </p>
        </div>
      </div>

      <div className="nav-actions">
        {/* Live Logs Toggle Button */}
        <button
          className={`btn btn-sm ${isLogsOpen ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onToggleLogs}
          title="Buka / Tutup Live Console Logs"
          style={{ position: 'relative' }}
        >
          <Terminal size={15} />
          <span>Live Logs</span>
          {errorCount > 0 && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: '#f43f5e',
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '9999px',
                marginLeft: 4,
              }}
            >
              {errorCount}
            </span>
          )}
        </button>

        {/* Custom RPC Settings Button */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={onOpenRpcSettings}
          title="Atur Custom RPC Node (QuickNode / Alchemy / Helius)"
        >
          <Server size={15} color="#818cf8" />
          <span>Custom RPC</span>
        </button>

        {wallets.length > 0 && (
          <>
            {/* Transfer All to One Wallet Button */}
            <button
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#000',
                fontWeight: 700,
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
                border: 'none',
              }}
              onClick={onOpenTransferAll}
              title="Transfer All to One Wallet - Akumulasi & Konsolidasi seluruh aset"
            >
              <Send size={15} color="#000" />
              <span>Transfer All</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenAnalytics}
              title="View Asset Distribution"
            >
              <PieChart size={16} />
              <span>Analitik</span>
            </button>

            {/* Export Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export data"
              >
                <Download size={16} />
                <span>Export</span>
                <ChevronDown size={14} />
              </button>

              {showExportMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '115%',
                    right: 0,
                    background: '#0f172a',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 60,
                    minWidth: 230,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    SAFE EXPORT (ALAMAT & SALDO)
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => handleExport('csv', false)}
                  >
                    📊 Export Safe CSV (Excel)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => handleExport('json', false)}
                  >
                    📦 Export Safe JSON
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => handleExport('txt', false)}
                  >
                    📝 Export Safe TXT Report
                  </button>

                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <div style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, color: '#f43f5e' }}>
                    FULL BACKUP (+ RAW SECRETS)
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => handleExport('csv', true)}
                  >
                    ⚠️ Full Backup CSV (+Keys)
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => handleExport('json', true)}
                  >
                    ⚠️ Full Backup JSON (+Keys)
                  </button>
                </div>
              )}
            </div>

            {/* Scan All Button */}
            <button
              className="btn btn-accent btn-sm"
              onClick={onScanAll}
              disabled={isScanning}
              title="Periksa semua saldo wallet di semua jaringan"
            >
              <RefreshCw size={16} className={isScanning ? 'scanning-pulse' : ''} />
              <span>{isScanning ? 'Memindai...' : 'Scan Semua'}</span>
            </button>

            {/* Clear All */}
            <button
              className="btn btn-danger btn-icon btn-sm"
              onClick={onClearAll}
              disabled={isScanning}
              title="Hapus semua wallet dari pantauan"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}

        {/* Import Button */}
        <button className="btn btn-primary" onClick={onOpenImport} disabled={isScanning}>
          <Upload size={17} />
          <span>Import Wallet</span>
        </button>
      </div>
    </nav>
  );
};

