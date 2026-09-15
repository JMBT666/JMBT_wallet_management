import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Layers, 
  Sparkles, 
  Tag, 
  RefreshCw, 
  Zap, 
  StopCircle,
  Copy,
  Check,
  Download,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { 
  parseWalletsFromTextAsync, 
  deriveWalletsAsync,
  ParseResult, 
  ParseProgress, 
  getCleanedExportText 
} from '../services/parser';
import { ParsedWalletItem } from '../types/wallet';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (wallets: ParsedWalletItem[], autoScan: boolean) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [inputText, setInputText] = useState('');
  const [accountsPerMnemonic, setAccountsPerMnemonic] = useState(1);
  const [defaultTag, setDefaultTag] = useState('');
  const [autoScanAfterImport, setAutoScanAfterImport] = useState(true);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedCleaned, setCopiedCleaned] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Large batch import configuration
  const [importLimit, setImportLimit] = useState<number>(500);
  const [isDeriving, setIsDeriving] = useState(false);
  const [derivationProgress, setDerivationProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<{ aborted: boolean }>({ aborted: false });
  const fullTextRef = useRef<string>('');

  useEffect(() => {
    const textToParse = fullTextRef.current || inputText;
    if (!textToParse.trim()) {
      setParseResult(null);
      setParseProgress(null);
      setIsParsing(false);
      return;
    }

    abortControllerRef.current.aborted = true; // cancel previous parsing
    const currentSignal = { aborted: false };
    abortControllerRef.current = currentSignal;

    setIsParsing(true);
    setParseResult(null);

    // Estimate line count for immediate progress display
    let estimatedLines = 1;
    for (let i = 0; i < textToParse.length; i++) {
      if (textToParse[i] === '\n') estimatedLines++;
    }

    setParseProgress({
      currentLine: 0,
      totalLines: estimatedLines,
      percent: 0,
      stats: { parsedCount: 0, mnemonicsCount: 0, privateKeysCount: 0, addressesCount: 0, duplicatesCount: 0, invalidCount: 0 }
    });

    const timer = setTimeout(async () => {
      try {
        const result = await parseWalletsFromTextAsync(
          textToParse,
          {
            accountsPerMnemonic,
            defaultTag: defaultTag.trim() || undefined,
          },
          (progress) => {
            if (!currentSignal.aborted) {
              setParseProgress(progress);
            }
          },
          currentSignal
        );

        if (!currentSignal.aborted) {
          setParseResult(result);
          setIsParsing(false);
        }
      } catch (e) {
        setIsParsing(false);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      currentSignal.aborted = true;
    };
  }, [inputText, accountsPerMnemonic, defaultTag]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        fullTextRef.current = content;
        // Lightweight preview if large file (> 20KB) to avoid React DOM textarea freeze
        if (content.length > 20000) {
          const firstChunk = content.slice(0, 1500);
          setInputText(`${firstChunk}\n\n... [File "${file.name}" berukuran ${(file.size / 1024 / 1024).toFixed(1)} MB berhasil dimuat]`);
        } else {
          setInputText(content);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSample = () => {
    setFileName(null);
    const sample = `# Contoh file import wallet (Mnemonic, Private Key, dan Public Address)
# 1. Mnemonic terhalang angka per kata (Otomatis dibersihkan)
1 abandon 2 abandon 3 abandon 4 abandon 5 abandon 6 abandon 7 abandon 8 abandon 9 abandon 10 abandon 11 abandon 12 about // Format Angka 1-12

# 2. Mnemonic standar 12 Kata
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about // Demo Duplikat (akan disaring)

# 3. Mnemonic dengan bullet numbering "1. word"
1. legal 2. winner 3. thank 4. year 5. wave 6. sausage 7. worth 8. useful 9. legal 10. winner 11. thank 12. year 13. wave 14. sausage 15. worth 16. useful 17. legal 18. winner 19. thank 20. year 21. wave 22. sausage 23. worth 24. title # Seed 24 Kata

# 4. EVM Private Key 64-Hex
4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d // Main EVM Key

# 5. EVM Address (Watch Only)
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 // Vitalik Watch Only

# 6. Baris sampah / chat / teks tidak valid (Otomatis dibuang):
À ghi ghhjj gbhjj ghhjj ụ dụ vbnjhg vọng
ازاي استخدم التداول اليومي للأسواق المالية ١٢
Random chatting text that is not a wallet
`;
    fullTextRef.current = sample;
    setInputText(sample);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.items.length === 0) return;

    // If wallets are already pre-derived and within limit, import directly
    if (parseResult.wallets.length > 0 && parseResult.items.length <= 200) {
      onImportSuccess(parseResult.wallets, autoScanAfterImport);
      setInputText('');
      fullTextRef.current = '';
      setParseResult(null);
      setFileName(null);
      onClose();
      return;
    }

    // Large list: slice to user-selected limit and derive asynchronously
    const targetItems = importLimit >= parseResult.items.length
      ? parseResult.items
      : parseResult.items.slice(0, importLimit);

    setIsDeriving(true);
    setDerivationProgress({ current: 0, total: targetItems.length, percent: 0 });

    try {
      const derived = await deriveWalletsAsync(
        targetItems,
        accountsPerMnemonic,
        defaultTag.trim() || undefined,
        (p) => setDerivationProgress(p)
      );

      setIsDeriving(false);
      onImportSuccess(derived, autoScanAfterImport);
      setInputText('');
      fullTextRef.current = '';
      setParseResult(null);
      setFileName(null);
      onClose();
    } catch {
      setIsDeriving(false);
    }
  };

  const handleCopyCleaned = () => {
    if (!parseResult || parseResult.items.length === 0) return;
    const cleanText = getCleanedExportText(parseResult.items);
    // Limit clipboard to first 5,000 to prevent browser clipboard freeze
    const snippet = parseResult.items.length > 5000 
      ? getCleanedExportText(parseResult.items.slice(0, 5000))
      : cleanText;
    navigator.clipboard.writeText(snippet);
    setCopiedCleaned(true);
    setTimeout(() => setCopiedCleaned(false), 2000);
  };

  const handleDownloadCleaned = () => {
    if (!parseResult || parseResult.items.length === 0) return;
    const cleanText = getCleanedExportText(parseResult.items);
    const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jmbt_wallets_clean_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon" style={{ width: 34, height: 34 }}>
              <Upload size={18} />
            </div>
            <div>
              <span className="modal-title">Smart Wallet Importer (Turbo Anti-Lag)</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Ekstraksi otomatis mnemonic berangka (1 word1 2 word2), pembersihan sampah & deduplikasi instan (300k+ baris).
              </p>
            </div>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* File Dropzone */}
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".txt,.csv,.json,.env"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="dropzone-icon">
              <FileText size={24} />
            </div>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {fileName ? `File terpilih: ${fileName}` : 'Klik untuk upload atau drag & drop file .txt / .csv (300.000+ baris)'}
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Didukung Turbo Engine non-blocking — file hingga ratusan ribu baris diproses dalam hitungan detik tanpa lag.
              </p>
            </div>
          </div>

          {/* Quick Sample Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Atau tempelkan baris teks di bawah:
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSample}
              style={{ fontSize: '0.78rem' }}
            >
              <Sparkles size={13} color="#f59e0b" />
              <span>Muat Contoh Data (Demo Format)</span>
            </button>
          </div>

          {/* Textarea */}
          <textarea
            className="form-textarea"
            placeholder="Tempelkan baris Mnemonic (12/24 kata standar atau berangka '1 phrase1 2 phrase2'), Private Key (64-hex/base58), atau Address (EVM / Solana / TRON T...) di sini...&#10;Data duplikat & baris sampah otomatis disaring dan diabaikan."
            value={inputText}
            onChange={(e) => {
              fullTextRef.current = e.target.value;
              setInputText(e.target.value);
              setFileName(null);
            }}
            rows={5}
          />

          {/* Configuration Options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {/* Tagging */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={14} /> Beri Label / Tag Otomatis
              </label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                placeholder="Contoh: Airdrop-Batch-1"
                value={defaultTag}
                onChange={(e) => setDefaultTag(e.target.value)}
              />
            </div>

            {/* Mnemonic derivation depth */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} /> Akun per Mnemonic
              </label>
              <select
                className="select-control"
                value={accountsPerMnemonic}
                onChange={(e) => setAccountsPerMnemonic(parseInt(e.target.value, 10))}
              >
                <option value={1}>1 Akun Utama (Tri-Chain: EVM m/44'/60', Solana m/44'/501', TRON m/44'/195')</option>
                <option value={2}>2 Akun Pertama (EVM, Solana, TRON)</option>
                <option value={3}>3 Akun Pertama (EVM, Solana, TRON)</option>
                <option value={5}>5 Akun Pertama (EVM, Solana, TRON)</option>
              </select>
            </div>

            {/* Auto scan toggle */}
            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 24, fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={autoScanAfterImport}
                  onChange={(e) => setAutoScanAfterImport(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#10b981' }}
                />
                <span style={{ fontWeight: 600 }}>⚡ Auto-Scan Saldo Setelah Import</span>
              </label>
            </div>
          </div>

          {/* Progress Indicator for Live Parsing */}
          {isParsing && parseProgress && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 700 }}>
                  <RefreshCw size={14} className="scanning-pulse" />
                  <span>
                    Menganalisis baris {parseProgress.currentLine.toLocaleString()} dari {parseProgress.totalLines.toLocaleString()} ({parseProgress.percent}%)...
                  </span>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  onClick={() => {
                    abortControllerRef.current.aborted = true;
                    setIsParsing(false);
                  }}
                >
                  <StopCircle size={12} /> Hentikan
                </button>
              </div>

              <div className="progress-bar-track" style={{ height: 6 }}>
                <div className="progress-bar-fill" style={{ width: `${parseProgress.percent}%` }} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                <span className="badge badge-mnemonic">🔑 {parseProgress.stats.mnemonicsCount.toLocaleString()} Mnemonics Valid</span>
                <span className="badge badge-privateKey">🗝️ {parseProgress.stats.privateKeysCount.toLocaleString()} Keys</span>
                <span className="badge badge-address">👀 {parseProgress.stats.addressesCount.toLocaleString()} Addr</span>
                {parseProgress.stats.duplicatesCount > 0 && (
                  <span className="badge badge-empty">🔄 {parseProgress.stats.duplicatesCount.toLocaleString()} Duplikat</span>
                )}
                {parseProgress.stats.invalidCount > 0 && (
                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
                    🗑️ {parseProgress.stats.invalidCount.toLocaleString()} Dibuang
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Derivation Progress for Large Import */}
          {isDeriving && derivationProgress && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', fontWeight: 700 }}>
                  <RefreshCw size={14} className="scanning-pulse" />
                  <span>
                    Menderivasi address akun {derivationProgress.current.toLocaleString()} dari {derivationProgress.total.toLocaleString()} ({derivationProgress.percent}%)...
                  </span>
                </div>
              </div>
              <div className="progress-bar-track" style={{ height: 6 }}>
                <div className="progress-bar-fill" style={{ width: `${derivationProgress.percent}%`, background: '#3b82f6' }} />
              </div>
            </div>
          )}

          {/* Live Analysis Parser Summary Card */}
          {!isParsing && parseResult && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Analisa Selesai: {parseResult.stats.parsedCount.toLocaleString()} Wallet Bersih Terdeteksi!
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {parseResult.items.length > 0 && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleCopyCleaned}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        title="Salin cuplikan data bersih"
                      >
                        {copiedCleaned ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                        <span>{copiedCleaned ? 'Tersalin!' : 'Salin Data Bersih'}</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleDownloadCleaned}
                        style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#60a5fa' }}
                        title="Download semua data valid dan bersih ke file .txt"
                      >
                        <Download size={12} />
                        <span>Download File Bersih (.txt)</span>
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {parseResult.stats.totalLines.toLocaleString()} baris dipindai
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span className="badge badge-mnemonic">
                  🔑 {parseResult.stats.mnemonicsCount.toLocaleString()} Mnemonics Valid
                </span>
                <span className="badge badge-privateKey">
                  🗝️ {parseResult.stats.privateKeysCount.toLocaleString()} Private Keys
                </span>
                <span className="badge badge-address">
                  👀 {parseResult.stats.addressesCount.toLocaleString()} Addresses
                </span>
                {parseResult.stats.duplicatesCount > 0 && (
                  <span className="badge badge-empty">
                    🔄 {parseResult.stats.duplicatesCount.toLocaleString()} Duplikat Diabaikan
                  </span>
                )}
                {parseResult.stats.invalidCount > 0 && (
                  <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                    🗑️ {parseResult.stats.invalidCount.toLocaleString()} Baris Tidak Valid Dibuang
                  </span>
                )}
              </div>

              {/* Large list import batch selector */}
              {parseResult.items.length > 200 && (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#10b981" />
                    Batas Import ke Dashboard (Untuk menjaga performa aplikasi):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {[100, 500, 1000, 5000].map((count) => (
                      <button
                        key={count}
                        className={`btn btn-sm ${importLimit === count ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => setImportLimit(count)}
                      >
                        {count.toLocaleString()}
                      </button>
                    ))}
                    <button
                      className={`btn btn-sm ${importLimit >= parseResult.items.length ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => setImportLimit(parseResult.items.length)}
                    >
                      Semua ({parseResult.items.length.toLocaleString()})
                    </button>
                  </div>
                </div>
              )}

              {/* Error details preview */}
              {parseResult.errors.length > 0 && (
                <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: '0.75rem', color: '#fda4af', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Contoh baris yang otomatis dibuang karena tidak valid:
                  </div>
                  {parseResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={12} />
                      <span>Baris {err.line}: {err.reason} ({err.text})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isDeriving}>
            Batal
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={isParsing || isDeriving || !parseResult || parseResult.items.length === 0}
          >
            {isDeriving ? (
              <>
                <RefreshCw size={16} className="scanning-pulse" />
                <span>Menderivasi...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>
                  Import {
                    parseResult 
                      ? Math.min(importLimit, parseResult.items.length).toLocaleString() 
                      : 0
                  } Wallet ke Dashboard
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

