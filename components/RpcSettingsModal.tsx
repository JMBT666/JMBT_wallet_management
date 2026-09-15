import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server, 
  Check, 
  ExternalLink, 
  Zap, 
  HelpCircle, 
  Save, 
  RotateCcw, 
  Search, 
  Activity, 
  ShieldCheck, 
  Globe, 
  Sparkles, 
  Layers, 
  Database,
  RefreshCw,
  Plus,
  Trash2
} from 'lucide-react';
import { SUPPORTED_CHAINS } from '../config/chains';
import { getStoredCustomRpcs, saveStoredCustomRpcs, CustomRpcConfig } from '../services/rpcConfig';
import { 
  getStoredCovalentKeys, 
  saveStoredCovalentKeys, 
  isCovalentEnabled, 
  saveCovalentEnabled, 
  testAllCovalentKeys,
  DEFAULT_COVALENT_KEYS
} from '../services/covalentService';
import { 
  getStoredDrpcKeys, 
  saveStoredDrpcKeys, 
  isDrpcEnabled, 
  saveDrpcEnabled, 
  testAllDrpcKeys, 
  DEFAULT_DRPC_KEYS 
} from '../services/drpcService';
import { 
  getStoredHeliusKeys, 
  saveStoredHeliusKeys, 
  testAllHeliusKeys, 
  DEFAULT_HELIUS_KEYS 
} from '../services/heliusService';
import { 
  isBlockchairEnabled, 
  saveBlockchairEnabled, 
  testBlockchairFetching 
} from '../services/blockchairService';
import { 
  getStoredInfuraKey, 
  saveStoredInfuraKey, 
  isInfuraEnabled, 
  saveInfuraEnabled, 
  testInfuraKey, 
  DEFAULT_INFURA_KEY 
} from '../services/infuraService';
import { logger } from '../services/logger';

interface RpcSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RpcSettingsModal: React.FC<RpcSettingsModalProps> = ({ isOpen, onClose }) => {
  const [customRpcs, setCustomRpcs] = useState<CustomRpcConfig>({});
  const [testResults, setTestResults] = useState<Record<string, { status: 'testing' | 'success' | 'error'; ms?: number; message?: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'helius' | 'mainnet' | 'testnet'>('all');
  const [isSaved, setIsSaved] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Covalent GoldRush Multi-Key Pool State
  const [covalentKeys, setCovalentKeys] = useState<string[]>(getStoredCovalentKeys());
  const [newCovalentKey, setNewCovalentKey] = useState('');
  const [covalentEnabled, setCovalentEnabledState] = useState(isCovalentEnabled());
  const [covalentTests, setCovalentTests] = useState<{ key: string; status: 'success' | 'error'; ms?: number; message?: string }[]>([]);
  const [isTestingCovalent, setIsTestingCovalent] = useState(false);

  // dRPC Multi-Key Pool State (EVM Multi-Chain)
  const [drpcKeys, setDrpcKeys] = useState<string[]>(getStoredDrpcKeys());
  const [newDrpcKey, setNewDrpcKey] = useState('');
  const [drpcEnabled, setDrpcEnabledState] = useState(isDrpcEnabled());
  const [drpcTests, setDrpcTests] = useState<{ key: string; status: 'success' | 'error'; ms?: number; message?: string }[]>([]);
  const [isTestingDrpc, setIsTestingDrpc] = useState(false);

  // Blockchair Fallback Engine State
  const [blockchairEnabled, setBlockchairEnabledState] = useState(isBlockchairEnabled());
  const [blockchairTest, setBlockchairTest] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  // Helius Multi-Key Pool State
  const [heliusKeys, setHeliusKeys] = useState<string[]>(getStoredHeliusKeys());
  const [newHeliusKey, setNewHeliusKey] = useState('');
  const [heliusTests, setHeliusTests] = useState<{ key: string; status: 'success' | 'error'; ms?: number; message?: string }[]>([]);
  const [isTestingHelius, setIsTestingHelius] = useState(false);

  // Infura Dedicated High-Speed Node State
  const [infuraKey, setInfuraKey] = useState<string>(getStoredInfuraKey());
  const [infuraEnabled, setInfuraEnabledState] = useState(isInfuraEnabled());
  const [infuraTest, setInfuraTest] = useState<{
    ethereum?: { status: 'success' | 'error'; ms?: number; message?: string };
    bsc?: { status: 'success' | 'error'; ms?: number; message?: string };
  } | null>(null);
  const [isTestingInfura, setIsTestingInfura] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomRpcs(getStoredCustomRpcs());
      setCovalentKeys(getStoredCovalentKeys());
      setCovalentEnabledState(isCovalentEnabled());
      setDrpcKeys(getStoredDrpcKeys());
      setDrpcEnabledState(isDrpcEnabled());
      setBlockchairEnabledState(isBlockchairEnabled());
      setHeliusKeys(getStoredHeliusKeys());
      setInfuraKey(getStoredInfuraKey());
      setInfuraEnabledState(isInfuraEnabled());
      setInfuraTest(null);
      setTestResults({});
      setCovalentTests([]);
      setDrpcTests([]);
      setBlockchairTest({ status: 'idle' });
      setHeliusTests([]);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUrlChange = (chainId: string, url: string) => {
    setCustomRpcs((prev) => ({
      ...prev,
      [chainId]: url,
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    // Clean up empty strings
    const cleaned: CustomRpcConfig = {};
    for (const [k, v] of Object.entries(customRpcs)) {
      if (v && v.trim().length > 0) {
        cleaned[k] = v.trim();
      }
    }
    saveStoredCustomRpcs(cleaned);
    setCustomRpcs(cleaned);

    // Save Covalent Multi-Keys
    saveStoredCovalentKeys(covalentKeys);
    saveCovalentEnabled(covalentEnabled);

    // Save dRPC Multi-Keys
    saveStoredDrpcKeys(drpcKeys);
    saveDrpcEnabled(drpcEnabled);

    // Save Blockchair
    saveBlockchairEnabled(blockchairEnabled);

    // Save Helius Keys
    saveStoredHeliusKeys(heliusKeys);

    // Save Infura Key & State
    saveStoredInfuraKey(infuraKey);
    saveInfuraEnabled(infuraEnabled);

    setIsSaved(true);
    logger.success('SYSTEM', `⚙️ Konfigurasi Infura, Helius, dRPC, Covalent & Custom RPC berhasil disimpan!`);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = (chainId: string) => {
    setCustomRpcs((prev) => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
    setIsSaved(false);
  };

  const handleTestRpc = async (chainId: string, url: string) => {
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();
    
    setTestResults((prev) => ({
      ...prev,
      [chainId]: { status: 'testing' },
    }));

    const start = performance.now();
    try {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
      const isSolana = chain?.type === 'solana';

      const payload = isSolana
        ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' })
        : JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        setTestResults((prev) => ({
          ...prev,
          [chainId]: { status: 'success', ms: elapsed, message: `OK (${elapsed}ms)` },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [chainId]: { status: 'error', message: `HTTP ${res.status}` },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [chainId]: { status: 'error', message: err.name === 'AbortError' ? 'Timeout (>6s)' : 'Failed (CORS/Offline)' },
      }));
    }
  };

  // Covalent Multi-Key Handlers
  const handleTestAllCovalent = async () => {
    setIsTestingCovalent(true);
    const results = await testAllCovalentKeys(covalentKeys);
    setCovalentTests(results);
    setIsTestingCovalent(false);
  };

  const handleAddCovalentKey = () => {
    if (!newCovalentKey.trim()) return;
    const tokens = newCovalentKey.split(/[\s,\n\r]+/).map((k) => k.trim()).filter((k) => k.length > 0);
    const updated = [...covalentKeys];
    for (const token of tokens) {
      if (!updated.includes(token)) {
        updated.push(token);
      }
    }
    setCovalentKeys(updated);
    setNewCovalentKey('');
    setIsSaved(false);
  };

  const handleRemoveCovalentKey = (indexToRemove: number) => {
    const updated = covalentKeys.filter((_, idx) => idx !== indexToRemove);
    setCovalentKeys(updated);
    setIsSaved(false);
  };

  const handleResetCovalentToDefault = () => {
    setCovalentKeys([...DEFAULT_COVALENT_KEYS]);
    setCovalentTests([]);
    setIsSaved(false);
  };

  // dRPC Multi-Key Handlers
  const handleTestAllDrpc = async () => {
    setIsTestingDrpc(true);
    const results = await testAllDrpcKeys(drpcKeys);
    setDrpcTests(results);
    setIsTestingDrpc(false);
  };

  const handleAddDrpcKey = () => {
    if (!newDrpcKey.trim()) return;
    const tokens = newDrpcKey.split(/[\s,\n\r]+/).map((k) => k.trim()).filter((k) => k.length > 0);
    const updated = [...drpcKeys];
    for (const token of tokens) {
      if (!updated.includes(token)) {
        updated.push(token);
      }
    }
    setDrpcKeys(updated);
    setNewDrpcKey('');
    setIsSaved(false);
  };

  const handleRemoveDrpcKey = (indexToRemove: number) => {
    const updated = drpcKeys.filter((_, idx) => idx !== indexToRemove);
    setDrpcKeys(updated);
    setIsSaved(false);
  };

  const handleResetDrpcToDefault = () => {
    setDrpcKeys([...DEFAULT_DRPC_KEYS]);
    setDrpcTests([]);
    setIsSaved(false);
  };

  // Infura Handlers
  const handleTestInfura = async () => {
    setIsTestingInfura(true);
    const res = await testInfuraKey(infuraKey);
    setInfuraTest(res);
    setIsTestingInfura(false);
  };

  const handleResetInfuraToDefault = () => {
    setInfuraKey(DEFAULT_INFURA_KEY);
    setInfuraTest(null);
    setIsSaved(false);
  };

  // Blockchair Fallback Test
  const handleTestBlockchair = async () => {
    setBlockchairTest({ status: 'testing' });
    const res = await testBlockchairFetching();
    if (res.success) {
      setBlockchairTest({ status: 'success', message: res.message });
    } else {
      setBlockchairTest({ status: 'error', message: res.message });
    }
  };

  // Helius Multi-Key Handlers
  const handleTestAllHelius = async () => {
    setIsTestingHelius(true);
    const results = await testAllHeliusKeys();
    setHeliusTests(results);
    setIsTestingHelius(false);
  };

  const handleAddHeliusKey = () => {
    if (!newHeliusKey.trim()) return;
    const tokens = newHeliusKey.split(/[\s,\n\r]+/).map((k) => k.trim()).filter((k) => k.length > 0);
    const updated = [...heliusKeys];
    for (const token of tokens) {
      if (!updated.includes(token)) {
        updated.push(token);
      }
    }
    setHeliusKeys(updated);
    setNewHeliusKey('');
    setIsSaved(false);
  };

  const handleRemoveHeliusKey = (indexToRemove: number) => {
    const updated = heliusKeys.filter((_, idx) => idx !== indexToRemove);
    setHeliusKeys(updated);
    setIsSaved(false);
  };

  const handleResetHeliusToDefault = () => {
    setHeliusKeys([...DEFAULT_HELIUS_KEYS]);
    setHeliusTests([]);
    setIsSaved(false);
  };

  const filteredChains = SUPPORTED_CHAINS.filter((chain) => {
    const matchesSearch = chain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chain.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chain.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (selectedTab === 'mainnet') return chain.category === 'mainnet';
    if (selectedTab === 'testnet') return chain.category === 'testnet';
    if (selectedTab === 'helius') return chain.type === 'solana';
    return true;
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-container" style={{ maxWidth: '920px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(20, 241, 149, 0.15)', color: '#14F195', padding: '8px', borderRadius: '10px' }}>
              <Zap size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Pengaturan Helius Multi-API & Node RPC</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Solana Helius Multi-Key Load Balancer, Covalent GoldRush Unified Engine, & Custom RPC.
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* ================= HELIUS SOLANA ROTATOR POOL CARD ================= */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(20, 241, 149, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(20, 241, 149, 0.35)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>⚡</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '1rem', color: '#14F195' }}>Helius Solana Multi-Key Pool</strong>
                    <span style={{ fontSize: '0.68rem', background: '#14F195', color: '#000', padding: '1px 7px', borderRadius: '9999px', fontWeight: 800 }}>
                      ROTASI & MULTI-API AKTIF ({heliusKeys.length} KEYS)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Setiap scan saldo & eksekusi burn dirotasi otomatis secara round-robin ke 5 key Helius untuk beban terdistribusi 100% bebas rate limit.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleTestAllHelius}
                  disabled={isTestingHelius}
                  style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4, background: '#10b981', borderColor: '#10b981', color: '#000', fontWeight: 700 }}
                >
                  <Activity size={13} />
                  <span>{isTestingHelius ? 'Menguji Semua...' : '⚡ Uji Semua Key Helius'}</span>
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleResetHeliusToDefault}
                  title="Reset ke 5 default Helius key"
                  style={{ fontSize: '0.76rem' }}
                >
                  Reset Default
                </button>
              </div>
            </div>

            {/* List of Active Helius Keys */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {heliusKeys.map((k, idx) => {
                const testRes = heliusTests.find((t) => t.key === k);
                return (
                  <div 
                    key={idx}
                    style={{ 
                      background: 'var(--card-bg-elevated)', 
                      borderRadius: '8px', 
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(20, 241, 149, 0.2)', color: '#14F195', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Slot #{idx + 1}
                      </span>
                      <code style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {k.startsWith('http') ? k : `https://mainnet.helius-rpc.com/?api-key=${k}`}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {testRes && (
                        <span style={{ fontSize: '0.72rem', color: testRes.status === 'success' ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                          {testRes.status === 'success' ? `✅ ${testRes.message}` : `❌ ${testRes.message}`}
                        </span>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => handleRemoveHeliusKey(idx)}
                        title="Hapus Key ini"
                        style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Key Field */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tambah Helius Key baru (UUID atau URL lengkap)..."
                value={newHeliusKey}
                onChange={(e) => setNewHeliusKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddHeliusKey()}
                className="form-control"
                style={{ fontSize: '0.8rem', height: '34px', flex: 1, fontFamily: 'monospace' }}
              />
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAddHeliusKey}
                disabled={!newHeliusKey.trim()}
                style={{ height: '34px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} />
                <span>Tambah Slot</span>
              </button>
            </div>
          </div>

          {/* ================= COVALENT GOLDRUSH MULTI-KEY POOL CARD ================= */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(234, 88, 12, 0.35)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🔥</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#fb923c' }}>Covalent GoldRush Multi-Key Pool</strong>
                    <span style={{ fontSize: '0.68rem', background: '#ea580c', color: '#fff', padding: '1px 7px', borderRadius: '9999px', fontWeight: 800 }}>
                      ROTASI & MULTI-API AKTIF ({covalentKeys.length} KEYS)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Menemukan seluruh token ERC-20 & Native di 100+ chain. Permintaan otomatis dirotasi antar-key untuk bebas limit 429.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleTestAllCovalent}
                  disabled={isTestingCovalent || !covalentEnabled}
                  style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4, background: '#ea580c', borderColor: '#ea580c', color: '#fff', fontWeight: 700 }}
                >
                  <Activity size={13} />
                  <span>{isTestingCovalent ? 'Menguji Semua...' : '⚡ Uji Semua Key Covalent'}</span>
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleResetCovalentToDefault}
                  title="Reset ke default Covalent keys"
                  style={{ fontSize: '0.76rem' }}
                >
                  Reset Default
                </button>

                {/* Enable Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginLeft: 6 }}>
                  <input 
                    type="checkbox" 
                    checked={covalentEnabled} 
                    onChange={(e) => {
                      setCovalentEnabledState(e.target.checked);
                      setIsSaved(false);
                    }}
                    style={{ width: 16, height: 16, accentColor: '#ea580c' }}
                  />
                  <span>Aktif</span>
                </label>
              </div>
            </div>

            {/* List of Active Covalent Keys */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {covalentKeys.map((k, idx) => {
                const testRes = covalentTests.find((t) => t.key === k);
                return (
                  <div 
                    key={idx}
                    style={{ 
                      background: 'var(--card-bg-elevated)', 
                      borderRadius: '8px', 
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(234, 88, 12, 0.2)', color: '#fb923c', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Slot #{idx + 1}
                      </span>
                      <code style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {k.length > 20 ? `${k.slice(0, 10)}••••••••${k.slice(-8)}` : k}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {testRes && (
                        <span style={{ fontSize: '0.72rem', color: testRes.status === 'success' ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                          {testRes.status === 'success' ? `✅ ${testRes.message}` : `❌ ${testRes.message}`}
                        </span>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => handleRemoveCovalentKey(idx)}
                        title="Hapus Key ini"
                        style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Key Field */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tambah Covalent API Key baru (bisa masukkan beberapa sekaligus dipisah koma/spasi/baris)..."
                value={newCovalentKey}
                onChange={(e) => setNewCovalentKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCovalentKey()}
                className="form-control"
                style={{ fontSize: '0.8rem', height: '34px', flex: 1, fontFamily: 'monospace' }}
              />
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAddCovalentKey}
                disabled={!newCovalentKey.trim()}
                style={{ height: '34px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} />
                <span>Tambah Slot</span>
              </button>
            </div>
          </div>

          {/* ================= DRPC MULTI-KEY LOAD BALANCER CARD (EVM & HOLESKY) ================= */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🌐</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#a5b4fc' }}>dRPC Multi-Key Load Balancer (EVM Multi-Chain)</strong>
                    <span style={{ fontSize: '0.68rem', background: '#6366f1', color: '#fff', padding: '1px 7px', borderRadius: '9999px', fontWeight: 800 }}>
                      MULTI-API AKTIF ({drpcKeys.length} KEYS)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Dedicated RPC multi-chain untuk Ethereum Mainnet, Sepolia Testnet, BSC, Polygon, Arbitrum, Base, Optimism & Avalanche.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleTestAllDrpc}
                  disabled={isTestingDrpc || !drpcEnabled}
                  style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4, background: '#6366f1', borderColor: '#6366f1', color: '#fff', fontWeight: 700 }}
                >
                  <Activity size={13} />
                  <span>{isTestingDrpc ? 'Menguji Semua...' : '⚡ Uji Semua Key dRPC'}</span>
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleResetDrpcToDefault}
                  title="Reset ke default dRPC keys"
                  style={{ fontSize: '0.76rem' }}
                >
                  Reset Default
                </button>

                {/* Enable Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginLeft: 6 }}>
                  <input 
                    type="checkbox" 
                    checked={drpcEnabled} 
                    onChange={(e) => {
                      setDrpcEnabledState(e.target.checked);
                      setIsSaved(false);
                    }}
                    style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                  />
                  <span>Aktif</span>
                </label>
              </div>
            </div>

            {/* List of Active dRPC Keys */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {drpcKeys.map((k, idx) => {
                const testRes = drpcTests.find((t) => t.key === k);
                return (
                  <div 
                    key={idx}
                    style={{ 
                      background: 'var(--card-bg-elevated)', 
                      borderRadius: '8px', 
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Slot #{idx + 1}
                      </span>
                      <code style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {k.startsWith('http') ? k : `https://lb.drpc.live/{chain}/${k}`}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {testRes && (
                        <span style={{ fontSize: '0.72rem', color: testRes.status === 'success' ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                          {testRes.status === 'success' ? `✅ ${testRes.message}` : `❌ ${testRes.message}`}
                        </span>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => handleRemoveDrpcKey(idx)}
                        title="Hapus Key ini"
                        style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Key Field */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Tambah dRPC Key baru (misal: AlR5Bwaj40... atau URL lb.drpc.live...)"
                value={newDrpcKey}
                onChange={(e) => setNewDrpcKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDrpcKey()}
                className="form-control"
                style={{ fontSize: '0.8rem', height: '34px', flex: 1, fontFamily: 'monospace' }}
              />
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAddDrpcKey}
                disabled={!newDrpcKey.trim()}
                style={{ height: '34px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} />
                <span>Tambah Slot</span>
              </button>
            </div>
          </div>

          {/* ================= INFURA HIGH-SPEED DEDICATED RPC CARD (EVM PRIORITY #1) ================= */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.12) 0%, rgba(249, 115, 22, 0.08) 100%)',
            border: '1px solid rgba(255, 107, 0, 0.35)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🔥</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#fb923c' }}>Infura High-Speed Dedicated Node (Prioritas #1 EVM & BSC)</strong>
                    <span style={{ fontSize: '0.68rem', background: '#f97316', color: '#fff', padding: '1px 7px', borderRadius: '9999px', fontWeight: 800 }}>
                      PRIORITAS UTAMA TRANSFER
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Dedicated enterprise RPC endpoint tanpa rate limit 429 untuk Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Linea & Avalanche.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleTestInfura}
                  disabled={isTestingInfura || !infuraEnabled}
                  style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 4, background: '#f97316', borderColor: '#f97316', color: '#fff', fontWeight: 700 }}
                >
                  <Activity size={13} />
                  <span>{isTestingInfura ? 'Menguji Latensi...' : '⚡ Uji Koneksi Infura'}</span>
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleResetInfuraToDefault}
                  title="Reset ke default Infura key"
                  style={{ fontSize: '0.76rem' }}
                >
                  Reset Default
                </button>

                {/* Enable Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginLeft: 6 }}>
                  <input 
                    type="checkbox" 
                    checked={infuraEnabled} 
                    onChange={(e) => {
                      setInfuraEnabledState(e.target.checked);
                      setIsSaved(false);
                    }}
                    style={{ width: 16, height: 16, accentColor: '#f97316' }}
                  />
                  <span>Aktif</span>
                </label>
              </div>
            </div>

            {/* Infura Key Input & Test Result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Infura API Key (misal: 2d6d988c7e014bc2b7c4d494248c1daf)"
                  value={infuraKey}
                  onChange={(e) => {
                    setInfuraKey(e.target.value.trim());
                    setIsSaved(false);
                  }}
                  className="form-control"
                  style={{ fontSize: '0.8rem', height: '34px', flex: 1, fontFamily: 'monospace' }}
                />
              </div>

              {infuraTest && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.76rem' }}>
                  <div style={{ 
                    background: 'var(--card-bg-elevated)', 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <strong>Ethereum:</strong>
                    <span style={{ color: infuraTest.ethereum?.status === 'success' ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                      {infuraTest.ethereum?.status === 'success' 
                        ? `✅ OK (${infuraTest.ethereum.ms}ms, ${infuraTest.ethereum.message})`
                        : `❌ ${infuraTest.ethereum?.message || 'Error'}`}
                    </span>
                  </div>
                  <div style={{ 
                    background: 'var(--card-bg-elevated)', 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <strong>BSC (BNB Chain):</strong>
                    <span style={{ color: infuraTest.bsc?.status === 'success' ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                      {infuraTest.bsc?.status === 'success' 
                        ? `✅ OK (${infuraTest.bsc.ms}ms, ${infuraTest.bsc.message})`
                        : `❌ ${infuraTest.bsc?.message || 'Error'}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= BLOCKCHAIR MULTI-CHAIN FALLBACK CARD ================= */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>🔍</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>Blockchair Multi-Chain Fallback Engine</strong>
                    <span style={{ fontSize: '0.68rem', background: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '9999px', fontWeight: 700 }}>
                      HTML SCRAPING (TANPA API KEY)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Mengekstrak data saldo native (SOL/ETH/BNB) dan USD langsung dari elemen HTML Blockchair saat RPC utama terkena rate limit atau error.
                  </p>
                </div>
              </div>

              {/* Enable Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={blockchairEnabled} 
                  onChange={(e) => {
                    setBlockchairEnabledState(e.target.checked);
                    setIsSaved(false);
                  }}
                  style={{ width: 16, height: 16, accentColor: '#0284c7' }}
                />
                <span>Aktifkan Blockchair Fallback</span>
              </label>
            </div>

            {/* Blockchair Info & Test Button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '8px', 
              padding: '10px 14px', 
              border: '1px solid rgba(255,255,255,0.06)',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Metode: </span>
                <code style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4 }}>
                  Direct HTML Fetching & DOM Element Parsing
                </code>
                <span style={{ marginLeft: 8 }}>· Tidak memerlukan API Key</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleTestBlockchair}
                  disabled={!blockchairEnabled}
                  style={{ height: '34px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Activity size={14} />
                  <span>Uji Parsing HTML</span>
                </button>

                <a
                  href="https://blockchair.com/solana/address/oeYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-secondary"
                  style={{ height: '34px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                  title="Lihat sampel halaman Blockchair"
                >
                  <span>Sample Solana</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Blockchair Test Message */}
            {blockchairTest.status !== 'idle' && (
              <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {blockchairTest.status === 'testing' && <span style={{ color: 'var(--text-muted)' }}>⏳ Mengambil dan mem-parsing HTML Blockchair...</span>}
                {blockchairTest.status === 'success' && <span style={{ color: '#10b981', fontWeight: 600 }}>✅ {blockchairTest.message}</span>}
                {blockchairTest.status === 'error' && <span style={{ color: '#f43f5e', fontWeight: 600 }}>⚠️ {blockchairTest.message}</span>}
              </div>
            )}
          </div>

          {/* QuickNode Banner / Guide Toggle */}
          <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color="#6366f1" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>QuickNode & Dedicated RPC Endpoints per Chain</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={() => setShowGuide(!showGuide)}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <HelpCircle size={14} />
                {showGuide ? 'Tutup Panduan' : '📖 Cara Ambil RPC QuickNode'}
              </button>
              <a 
                href="https://dashboard.quicknode.com/endpoints" 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-sm btn-primary"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>Dashboard QuickNode</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Step-by-Step Guide Collapse */}
          {showGuide && (
            <div style={{ padding: '14px 18px', background: 'var(--card-bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '200px', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 6, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🚀 Cara Menyalin URL Endpoint QuickNode:</span>
              </h4>
              <ol style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-primary)', paddingLeft: '18px', margin: 0 }}>
                <li>Buka <a href="https://dashboard.quicknode.com/endpoints" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>QuickNode Endpoints Dashboard</a>.</li>
                <li>Klik nama Endpoint yang sudah Anda buat (misal: <strong>BSC</strong>, <strong>Ethereum</strong>, atau <strong>Polygon</strong>).</li>
                <li>Di bagian <strong>HTTP Provider</strong>, klik tombol <strong>Copy 📋</strong>.</li>
                <li>Paste URL lengkap pada baris jaringan terkait di bawah ini lalu klik <strong>Simpan Pengaturan</strong>.</li>
              </ol>
            </div>
          )}

          {/* Search & Category Tabs */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Cari jaringan (Solana, BSC, ETH, Polygon...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '36px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'helius', 'mainnet', 'testnet'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`btn btn-sm ${selectedTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTab(tab)}
                  style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}
                >
                  {tab === 'all' ? 'Semua' : tab === 'helius' ? '⚡ Solana Helius' : tab === 'mainnet' ? '🌐 Mainnets' : '🧪 Testnets'}
                </button>
              ))}
            </div>
          </div>

          {/* Chain RPC List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredChains.map((chain) => {
              const currentCustom = customRpcs[chain.id] || '';
              const testResult = testResults[chain.id];

              return (
                <div 
                  key={chain.id}
                  style={{
                    background: 'var(--card-bg-elevated)',
                    border: currentCustom ? '1px solid #6366f1' : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: chain.color,
                          display: 'inline-block' 
                        }} 
                      />
                      <strong style={{ fontSize: '0.9rem' }}>{chain.name}</strong>
                      <span style={{ fontSize: '0.72rem', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                        {chain.shortName}
                      </span>
                      {chain.id === 'solana-mainnet' && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(20, 241, 149, 0.2)', color: '#14F195', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          ⚡ Helius 5x Multi-Key Active
                        </span>
                      )}
                      {chain.category === 'testnet' && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '2px 6px', borderRadius: '4px' }}>
                          Testnet
                        </span>
                      )}
                      {currentCustom && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          ★ Prioritas Custom Aktif
                        </span>
                      )}
                    </div>
                    
                    {/* Default fallback info */}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {chain.rpcUrls.length} Node Cadangan
                    </span>
                  </div>

                  {/* Input & Action */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={`Contoh: https://xxxx.quiknode.pro/xxx/ atau default ${chain.rpcUrls[0]}`}
                      value={currentCustom}
                      onChange={(e) => handleUrlChange(chain.id, e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8rem', height: '34px', flex: 1, fontFamily: 'monospace' }}
                    />

                    {/* Test RPC Button */}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleTestRpc(chain.id, currentCustom || chain.rpcUrls[0])}
                      title="Uji respon RPC"
                      style={{ minWidth: '70px', height: '34px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Activity size={13} />
                      <span>Tes</span>
                    </button>

                    {/* Reset Button */}
                    {currentCustom && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleReset(chain.id)}
                        title="Kembalikan ke Default RPC"
                        style={{ height: '34px', padding: '0 8px' }}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>

                  {/* Test Result Message */}
                  {testResult && (
                    <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: -2 }}>
                      {testResult.status === 'testing' && (
                        <span style={{ color: 'var(--text-muted)' }}>⏳ Menguji latensi koneksi...</span>
                      )}
                      {testResult.status === 'success' && (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Respon Cepat: {testResult.message}</span>
                      )}
                      {testResult.status === 'error' && (
                        <span style={{ color: '#f43f5e', fontWeight: 600 }}>❌ Gagal: {testResult.message}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>Kredensial disimpan 100% lokal di browser Anda (LocalStorage).</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
            <button 
              className={`btn ${isSaved ? 'btn-success' : 'btn-primary'}`}
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isSaved ? <Check size={16} /> : <Save size={16} />}
              <span>{isSaved ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

