import { describe, expect, it } from 'vitest'
import { formatBaht, formatNumber, formatPercent } from './number'

describe('number formatters', () => {
  it('adds comma separators for thousands and keeps money decimals', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatBaht(1234567.89)).toBe('1,234,567.89')
    expect(formatPercent(1234.567, 1)).toBe('1,234.6%')
  })
})
