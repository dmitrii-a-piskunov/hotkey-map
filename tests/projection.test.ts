import { describe, expect, it } from 'vitest'
import { convexHull, rectToQuad, type Vec } from '@/components/devices/projection'

/** Применяет matrix3d к точке, как браузер */
function apply(matrix: string, x: number, y: number): Vec {
  const m = matrix.slice(9, -1).split(',').map(Number)
  const v = (i: number) => m[i] ?? NaN
  const X = v(0) * x + v(4) * y + v(12)
  const Y = v(1) * x + v(5) * y + v(13)
  const W = v(3) * x + v(7) * y + v(15)
  return { x: X / W, y: Y / W }
}

describe('rectToQuad', () => {
  const quad: [Vec, Vec, Vec, Vec] = [
    { x: 10, y: 5 },
    { x: 90, y: 8 },
    { x: 100, y: 60 },
    { x: 0, y: 55 },
  ]

  it('maps rectangle corners onto the quad', () => {
    const m = rectToQuad(40, 20, quad)
    const corners = [apply(m, 0, 0), apply(m, 40, 0), apply(m, 40, 20), apply(m, 0, 20)]
    quad.forEach((q, i) => {
      expect(corners[i]?.x ?? NaN).toBeCloseTo(q.x, 3)
      expect(corners[i]?.y ?? NaN).toBeCloseTo(q.y, 3)
    })
  })

  it('handles parallelograms (affine case)', () => {
    const m = rectToQuad(10, 10, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 10 },
      { x: 5, y: 10 },
    ])
    expect(apply(m, 10, 10).x).toBeCloseTo(15)
  })
})

describe('convexHull', () => {
  it('drops inner points', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ])
    expect(hull).toHaveLength(4)
  })
})
