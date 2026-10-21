import { describe, expect, it } from 'vitest'
import { shade } from '@/lib/color'

describe('shade', () => {
  it('keeps the color at k = 1', () => {
    expect(shade('#2c3446', 1)).toBe('rgb(44 52 70)')
  })

  it('darkens and clamps when brightening', () => {
    expect(shade('#808080', 0.5)).toBe('rgb(64 64 64)')
    expect(shade('#f0f0f0', 2)).toBe('rgb(255 255 255)')
  })
})
