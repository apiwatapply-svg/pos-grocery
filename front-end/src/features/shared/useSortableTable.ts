import { useCallback, useMemo, useState } from 'react'
import type { SortDirection } from './SortableTableHeader'

export type SortState<TKey extends string> = {
  key: TKey
  direction: SortDirection
}

export type SortableColumn<TRow> = {
  /**
   * Optional accessor for a stable, secondary sort key so equal primary
   * values never appear in a non-deterministic order.
   */
  fallback?: (row: TRow) => string | number
  /**
   * How the cell value should be normalized for comparison.
   * - `text` (default): locale-aware string compare using `Intl.Collator`
   * - `number`: numeric subtraction
   * - `raw`: returns the column value as-is (for Date, boolean, etc.)
   * - `custom`: lets the caller decide via `compare`
   */
  type?: 'text' | 'number' | 'raw' | 'custom'
  /** Optional custom compare when `type === 'custom'`. */
  compare?: (left: TRow, right: TRow) => number
  /** Accessor that returns the comparable value. Required for `text` and `number`. */
  get?: (row: TRow) => unknown
}

const THAI_COLLATOR = new Intl.Collator('th', { numeric: true, sensitivity: 'base' })

function compareRows<TRow, TKey extends string>(
  left: TRow,
  right: TRow,
  columns: Record<TKey, SortableColumn<TRow>>,
  state: SortState<TKey>,
): number {
  const column = columns[state.key]
  if (!column) {
    return 0
  }

  let comparison: number

  if (column.type === 'custom' && column.compare) {
    comparison = column.compare(left, right)
  } else if (column.type === 'number' && column.get) {
    const leftValue = Number(column.get(left) ?? 0)
    const rightValue = Number(column.get(right) ?? 0)
    comparison = leftValue - rightValue
  } else if (column.type === 'raw' && column.get) {
    const leftValue = column.get(left)
    const rightValue = column.get(right)
    if (leftValue === rightValue) {
      comparison = 0
    } else if (leftValue === null || leftValue === undefined) {
      comparison = 1
    } else if (rightValue === null || rightValue === undefined) {
      comparison = -1
    } else if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      comparison = leftValue - rightValue
    } else {
      comparison = THAI_COLLATOR.compare(String(leftValue), String(rightValue))
    }
  } else if (column.get) {
    const leftValue = String(column.get(left) ?? '')
    const rightValue = String(column.get(right) ?? '')
    comparison = THAI_COLLATOR.compare(leftValue, rightValue)
  } else {
    comparison = 0
  }

  if (comparison === 0 && column.fallback) {
    const leftFallback = column.fallback(left)
    const rightFallback = column.fallback(right)
    if (typeof leftFallback === 'number' && typeof rightFallback === 'number') {
      comparison = leftFallback - rightFallback
    } else {
      comparison = THAI_COLLATOR.compare(String(leftFallback), String(rightFallback))
    }
  }

  return state.direction === 'ascending' ? comparison : comparison * -1
}

export type UseSortableTableOptions<TKey extends string, TRow> = {
  /** Column definitions, keyed by their TKey. */
  columns: Record<TKey, SortableColumn<TRow>>
  /** Initial sort key. */
  initialKey: TKey
  /** Initial direction. Defaults to "ascending". */
  initialDirection?: SortDirection
}

export type UseSortableTableResult<TRow, TKey extends string> = {
  sortKey: TKey
  direction: SortDirection
  /** Toggle direction when the same key is clicked; otherwise reset to "ascending". */
  setSortKey: (key: TKey) => void
  sortedRows: TRow[]
}

/**
 * Lightweight sortable table state.
 *
 * - Returns the current `sortKey` + `direction` so consumers can render the
 *   matching header indicators.
 * - `setSortKey` flips the direction when the same key is selected, which
 *   matches the standard "click again to reverse" expectation.
 * - `sortedRows` is always a fresh array so it is safe to use in JSX
 *   without an extra `useMemo` at the call site.
 */
export function useSortableTable<TRow, TKey extends string>(
  rows: TRow[],
  options: UseSortableTableOptions<TKey, TRow>,
): UseSortableTableResult<TRow, TKey> {
  const { columns, initialKey, initialDirection = 'ascending' } = options
  const [state, setState] = useState<SortState<TKey>>({ key: initialKey, direction: initialDirection })

  const setSortKey = useCallback(
    (key: TKey) => {
      setState((current) =>
        current.key === key
          ? {
              key,
              direction: current.direction === 'ascending' ? 'descending' : 'ascending',
            }
          : { key, direction: initialDirection },
      )
    },
    [initialDirection],
  )

  const sortedRows = useMemo(() => {
    if (!rows.length) {
      return rows
    }

    const column = columns[state.key]
    if (!column) {
      return rows
    }

    return [...rows].sort((left, right) => compareRows(left, right, columns, state))
  }, [rows, columns, state])

  return {
    sortKey: state.key,
    direction: state.direction,
    setSortKey,
    sortedRows,
  }
}
