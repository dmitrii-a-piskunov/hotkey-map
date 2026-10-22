import { describe, expect, it } from 'vitest'
import { fill, formatDecimal, parseDecimal } from '@/lib/format'

describe('format', () => {
  it('fills placeholders with strings and numbers', () => {
    expect(fill('{a} и {b}, {c}', { a: 'x', b: 2 })).toBe('x и 2, {c}')
  })

  it('parses decimals with a comma or a dot (section 8.6)', () => {
    expect(parseDecimal('0,5')).toBe(0.5)
    expect(parseDecimal(' -1.25 ')).toBe(-1.25)
    expect(parseDecimal('10')).toBe(10)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('1e3')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })

  it('shows decimals with a comma', () => {
    expect(formatDecimal(0.5)).toBe('0,5')
    expect(formatDecimal(100)).toBe('100')
  })
})
