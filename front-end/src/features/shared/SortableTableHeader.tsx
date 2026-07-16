import type { ReactNode } from 'react'

export type SortDirection = 'ascending' | 'descending'

export type SortableTableHeaderProps<TKey extends string> = {
  /** Identifier of the column. Drives the sort state in the parent. */
  sortKey: TKey
  /** Current sort state. The component only reads it to render indicators + ARIA. */
  activeSortKey: TKey
  direction: SortDirection
  /** Called when the user activates the header (click or Enter/Space). */
  onSort: (key: TKey) => void
  /** Visible header label. */
  label: ReactNode
  /** Optional extra class names applied to the inner <th> element. */
  className?: string
  /** Optional scope for the rendered <th>. Defaults to "col". */
  scope?: 'col' | 'row'
  /** Optional explicit ARIA label override. */
  ariaLabel?: string
  /** Set to true when the column cannot be sorted (renders plain text). */
  disabled?: boolean
}

export function SortableTableHeader<TKey extends string>(props: SortableTableHeaderProps<TKey>) {
  const {
    sortKey,
    activeSortKey,
    direction,
    onSort,
    label,
    className,
    scope = 'col',
    ariaLabel,
    disabled = false,
  } = props

  const isActive = activeSortKey === sortKey
  const ariaSort = isActive ? direction : 'none'
  const indicator = !isActive ? '↕' : direction === 'ascending' ? '↑' : '↓'
  const directionLabel = !isActive
    ? 'เรียงลำดับ'
    : direction === 'ascending'
      ? 'เรียงจากน้อยไปมาก'
      : 'เรียงจากมากไปน้อย'
  const labelText = typeof label === 'string' ? label : (ariaLabel ?? '')
  const computedAriaLabel = ariaLabel ?? (labelText ? `${labelText} · ${directionLabel}` : directionLabel)

  if (disabled) {
    return (
      <th className={className} scope={scope}>
        <span className="table-sort-label">{label}</span>
      </th>
    )
  }

  return (
    <th aria-sort={ariaSort} className={className ? `sortable ${className}` : 'sortable'} scope={scope}>
      <button
        aria-label={computedAriaLabel}
        className="table-sort-button"
        type="button"
        onClick={() => onSort(sortKey)}
      >
        <span className="table-sort-label">{label}</span>
        <span aria-hidden="true" className="table-sort-indicator">
          {indicator}
        </span>
      </button>
    </th>
  )
}
