import { defaultPageSize } from './paginationUtils'
import { formatNumber } from '../../lib/format/number'

type PaginationControlsProps = {
  currentPage: number
  onPageChange: (page: number) => void
  pageSize?: number
  totalItems: number
}

export function PaginationControls({
  currentPage,
  onPageChange,
  pageSize = defaultPageSize,
  totalItems,
}: PaginationControlsProps) {
  if (totalItems <= pageSize) {
    return null
  }

  const totalPages = Math.ceil(totalItems / pageSize)
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <nav className="pagination-bar" aria-label="แบ่งหน้า">
      <span>แสดง {formatNumber(startItem)}-{formatNumber(endItem)} จาก {formatNumber(totalItems)} รายการ</span>
      <div className="pagination-actions">
        <button
          className="ghost-button compact"
          disabled={currentPage <= 1}
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
        >
          หน้าก่อนหน้า
        </button>
        <strong>หน้า {formatNumber(currentPage)} / {formatNumber(totalPages)}</strong>
        <button
          className="ghost-button compact"
          disabled={currentPage >= totalPages}
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
        >
          หน้าถัดไป
        </button>
      </div>
    </nav>
  )
}
