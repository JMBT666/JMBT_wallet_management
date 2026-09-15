import React from 'react';
import { 
  CheckSquare, 
  Square, 
  RefreshCw, 
  Flame, 
  Download, 
  Trash2, 
  X,
  Send
} from 'lucide-react';
import { ParsedWalletItem } from '../types/wallet';
import { exportWalletsToCsv, exportWalletsToJson } from '../services/exportService';

interface BatchActionBarProps {
  selectedWallets: ParsedWalletItem[];
  allFilteredWallets: ParsedWalletItem[];
  isScanning: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onScanSelected: () => void;
  onOpenSolanaBurn: () => void;
  onOpenTransferAll: () => void;
  onDeleteSelected: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedWallets,
  allFilteredWallets,
  isScanning,
  onSelectAll,
  onDeselectAll,
  onScanSelected,
  onOpenSolanaBurn,
  onOpenTransferAll,
  onDeleteSelected,
}) => {
  const isAllSelected = allFilteredWallets.length > 0 && selectedWallets.length === allFilteredWallets.length;
  const count = selectedWallets.length;

  // Filter how many selected wallets have Solana keys
  const solanaWalletsCount = selectedWallets.filter((w) => w.solanaAddress && w.type !== 'address').length;

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        marginBottom: 16,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        flexWrap: 'wrap',
        gap: 12,
        position: 'sticky',
        top: 80,
        zIndex: 35,
      }}
    >
      {/* Left: Selection info & select all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          style={{ padding: '6px 12px' }}
        >
          {isAllSelected ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} />}
          <span>{isAllSelected ? 'Batal Pilih Semua' : `Pilih Semua (${allFilteredWallets.length})`}</span>
        </button>

        {count > 0 && (
          <span className="badge badge-funded" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
            {count} Wallet Dipilih
          </span>
        )}
      </div>

      {/* Right: Actions on selected */}
      {count > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Scan Selected */}
          <button
            className="btn btn-accent btn-sm"
            onClick={onScanSelected}
            disabled={isScanning}
            title="Scan hanya wallet yang dipilih"
          >
            <RefreshCw size={14} className={isScanning ? 'scanning-pulse' : ''} />
            <span>Scan Terpilih ({count})</span>
          </button>

          {/* Transfer All Selected */}
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              color: '#000',
              fontWeight: 700,
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
              border: 'none',
            }}
            onClick={onOpenTransferAll}
            disabled={isScanning}
            title="Transfer All aset dari wallet yang dipilih ke satu wallet tujuan"
          >
            <Send size={14} color="#000" />
            <span>Transfer All Terpilih ({count})</span>
          </button>

          {/* Solana Burner */}
          {solanaWalletsCount > 0 && (
            <button
              className="btn btn-danger btn-sm"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ea580c)', border: 'none' }}
              onClick={onOpenSolanaBurn}
              title="Bakar token spam/scam & klaim rent SOL untuk wallet Solana terpilih"
            >
              <Flame size={14} />
              <span>Burn & Reclaim SOL ({solanaWalletsCount})</span>
            </button>
          )}

          {/* Export Selected */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => exportWalletsToCsv(selectedWallets, false)}
            title="Export Safe CSV untuk wallet yang dipilih"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {/* Delete Selected */}
          <button
            className="btn btn-danger btn-sm"
            onClick={onDeleteSelected}
            disabled={isScanning}
            title="Hapus wallet terpilih"
          >
            <Trash2 size={14} />
            <span>Hapus ({count})</span>
          </button>

          {/* Deselect cancel */}
          <button
            className="copy-btn"
            onClick={onDeselectAll}
            title="Tutup aksi batch"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Centang checkbox pada kartu/tabel wallet untuk melakukan aksi massal (Scan, Burn SOL, Export, Hapus).
        </div>
      )}
    </div>
  );
};

