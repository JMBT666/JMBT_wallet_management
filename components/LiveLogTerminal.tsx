import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Search, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { logger, LogEntry, LogLevel } from '../services/logger';

interface LiveLogTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveLogTerminal: React.FC<LiveLogTerminalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial logs
    setLogs(logger.getLogs());

    // Subscribe to new logs
    const unsubscribe = logger.subscribe(() => {
      setLogs(logger.getLogs());
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current && isOpen) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        log.timestamp.includes(q)
      );
    }
    return true;
  });

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}`)
      .reverse()
      .join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return '#fda4af';
      case 'warn': return '#fde047';
      case 'success': return '#86efac';
      default: return '#93c5fd';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'SCAN': return '#38bdf8';
      case 'RPC': return '#fb923c';
      case 'TOKEN': return '#c084fc';
      case 'BURN': return '#f43f5e';
      case 'PARSER': return '#a3e635';
      default: return '#94a3b8';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: '#07090e',
        borderTop: '2px solid rgba(16, 185, 129, 0.4)',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
        height: isMaximized ? '75vh' : '260px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.25s ease',
        animation: 'slideUp 0.2s ease-out',
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#0d131f',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {/* Left: Brand & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontWeight: 800, fontSize: '0.85rem' }}>
            <Terminal size={16} />
            <span>LIVE ENGINE LOGS</span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981',
                animation: 'pulseGlow 1.5s infinite',
              }}
            />
          </div>

          {errorCount > 0 && (
            <span
              className="badge"
              style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.4)', fontSize: '0.72rem' }}
            >
              🔴 {errorCount} Errors
            </span>
          )}

          {warnCount > 0 && (
            <span
              className="badge"
              style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.4)', fontSize: '0.72rem' }}
            >
              🟡 {warnCount} Warnings
            </span>
          )}
        </div>

        {/* Center: Search & Level Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 500, minWidth: 220 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari dalam log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 28px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
              }}
            />
          </div>

          <div className="category-tabs" style={{ padding: 2 }}>
            <button
              className={`tab-btn ${filterLevel === 'all' ? 'active' : ''}`}
              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
              onClick={() => setFilterLevel('all')}
            >
              Semua ({logs.length})
            </button>
            <button
              className={`tab-btn ${filterLevel === 'error' ? 'active' : ''}`}
              style={{ padding: '2px 6px', fontSize: '0.72rem', color: errorCount > 0 ? '#fda4af' : undefined }}
              onClick={() => setFilterLevel('error')}
            >
              Errors
            </button>
            <button
              className={`tab-btn ${filterLevel === 'warn' ? 'active' : ''}`}
              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
              onClick={() => setFilterLevel('warn')}
            >
              Warns
            </button>
            <button
              className={`tab-btn ${filterLevel === 'success' ? 'active' : ''}`}
              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
              onClick={() => setFilterLevel('success')}
            >
              Success
            </button>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ width: 13, height: 13 }}
            />
            <span>Auto-scroll</span>
          </label>

          <button
            className="copy-btn"
            onClick={handleCopyLogs}
            title="Salin Semua Log"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px' }}
          >
            {isCopied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{isCopied ? 'Tersalin' : 'Copy'}</span>
          </button>

          <button
            className="copy-btn"
            onClick={() => logger.clearLogs()}
            title="Bersihkan Log"
            style={{ padding: '3px 6px' }}
          >
            <Trash2 size={13} />
          </button>

          <button
            className="copy-btn"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Kecilkan Terminal' : 'Besarkan Terminal'}
            style={{ padding: '3px 6px' }}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <button
            className="copy-btn"
            onClick={onClose}
            title="Tutup Terminal"
            style={{ padding: '3px 6px' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Terminal Log Output Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: '1.6',
          display: 'flex',
          flexDirection: 'column-reverse', // latest at bottom or top
          gap: 2,
          background: '#06080d',
        }}
      >
        <div ref={terminalEndRef} />

        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: 12 }}>
            Belum ada log tercatat. Log akan otomatis muncul saat proses pemindaian atau eksekusi berlangsung.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                background: log.level === 'error' ? 'rgba(244, 63, 94, 0.08)' : 'transparent',
              }}
            >
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.72rem' }}>
                {log.timestamp}
              </span>

              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: getCategoryColor(log.category),
                  flexShrink: 0,
                }}
              >
                [{log.category}]
              </span>

              <span style={{ color: getLevelColor(log.level), wordBreak: 'break-all', flex: 1 }}>
                {log.level === 'error' && '❌ '}
                {log.level === 'warn' && '⚠️ '}
                {log.level === 'success' && '✅ '}
                {log.level === 'info' && '🔹 '}
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

