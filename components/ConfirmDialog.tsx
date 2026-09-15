import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 90 }}>
      <div
        className="modal-content"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="brand-icon"
              style={{
                width: 34,
                height: 34,
                background: isDanger ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                border: isDanger ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                color: isDanger ? '#fda4af' : '#fde047',
              }}
            >
              {isDanger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
            </div>
            <span className="modal-title" style={{ fontSize: '1.1rem' }}>
              {title}
            </span>
          </div>
          <button className="copy-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {message}
        </div>

        <div className="modal-footer" style={{ padding: '14px 24px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            style={isDanger ? { background: 'linear-gradient(135deg, #f43f5e, #e11d48)', border: 'none' } : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

