import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalItems <= 25 && itemsPerPage === 25) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        padding: '12px 16px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '0.85rem',
      }}
    >
      {/* Left: Summary & Per-Page Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{startItem} - {endItem}</strong> dari <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> wallet
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tampilkan:</span>
          <select
            className="select-control"
            style={{ padding: '3px 8px', fontSize: '0.8rem' }}
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={25}>25 per halaman</option>
            <option value={50}>50 per halaman</option>
            <option value={100}>100 per halaman</option>
            <option value={250}>250 per halaman</option>
          </select>
        </div>
      </div>

      {/* Right: Page Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px' }}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Halaman Pertama"
        >
          <ChevronsLeft size={14} />
        </button>

        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px' }}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Sebelumnya"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots_${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)' }}>
                ...
              </span>
            );
          }
          const pageNum = p as number;
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                minWidth: 32,
                padding: '4px 8px',
                fontWeight: isActive ? 800 : 500,
              }}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px' }}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Berikutnya"
        >
          <ChevronRight size={14} />
        </button>

        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px' }}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Halaman Terakhir"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

