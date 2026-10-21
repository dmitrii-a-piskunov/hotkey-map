import { describe, expect, it } from 'vitest'
import { center, containsPoint, intersects, rectFromPoints } from '@/domain/geometry'

describe('geometry', () => {
  it('center', () => {
    expect(center({ x: 1, y: 2, w: 2, h: 4 })).toEqual({ x: 2, y: 4 })
  })

  it('rectFromPoints normalizes corners', () => {
    expect(rectFromPoints({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 1, w: 3, h: 3 })
  })

  it('containsPoint includes borders', () => {
    const r = { x: 0, y: 0, w: 2, h: 2 }
    expect(containsPoint(r, { x: 2, y: 2 })).toBe(true)
    expect(containsPoint(r, { x: 2.1, y: 1 })).toBe(false)
  })

  it('intersects excludes touching edges', () => {
    const a = { x: 0, y: 0, w: 2, h: 2 }
    expect(intersects(a, { x: 1, y: 1, w: 2, h: 2 })).toBe(true)
    expect(intersects(a, { x: 2, y: 0, w: 2, h: 2 })).toBe(false)
  })
})
