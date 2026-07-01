export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat('th-TH', options).format(value)
}

export function formatBaht(value: number) {
  return formatNumber(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

export function formatPercent(value: number, fractionDigits = 2) {
  return `${formatNumber(value, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}%`
}
