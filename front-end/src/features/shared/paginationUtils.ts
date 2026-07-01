export const defaultPageSize = 10

export function paginateItems<T>(items: T[], currentPage: number, pageSize = defaultPageSize) {
  const safePage = Math.max(1, currentPage)
  const startIndex = (safePage - 1) * pageSize

  return {
    endIndex: Math.min(startIndex + pageSize, items.length),
    items: items.slice(startIndex, startIndex + pageSize),
    startIndex,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  }
}
