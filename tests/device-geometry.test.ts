import { describe, expect, it } from 'vitest'
import {
  capTiltRise,
  capTopInsets3d,
  keyboardWidth,
  keyWells,
  perspectiveShift,
} from '@/components/devices/device-geometry'
import { aulaF75 } from '@/layouts/aula-f75'

describe('device geometry', () => {
  it('splits wells into Esc, three F groups and the main block', () => {
    const wells = keyWells(aulaF75)
    expect(wells).toHaveLength(5)
    expect(wells[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(wells[1]).toEqual({ x: 2, y: 0, w: 4, h: 1 })
    expect(wells[4]).toEqual({ x: 0, y: 1.4, w: 16, h: 5 })
  })

  it('keyboard width includes the bezel', () => {
    expect(keyboardWidth(aulaF75)).toBeCloseTo(16.6)
  })
})

describe('3D cap top', () => {
  const key = (code: string) => {
    const k = aulaF75.keys.find((x) => x.code === code)
    if (!k) throw new Error(code)
    return k
  }

  it('shifts the top outward from the keyboard center', () => {
    expect(perspectiveShift(8, 16)).toBe(0)
    expect(perspectiveShift(0, 16)).toBeLessThan(0)
    expect(perspectiveShift(16, 16)).toBeGreaterThan(0)
    expect(perspectiveShift(-5, 16)).toBe(perspectiveShift(0, 16))
  })

  it('edge keys show only the inner side face', () => {
    const esc = capTopInsets3d(key('Escape'), aulaF75.width)
    expect(esc.left).toBeLessThan(0.02)
    expect(esc.right).toBeGreaterThan(0.2)
    const right = capTopInsets3d(key('ArrowRight'), aulaF75.width)
    expect(right.right).toBeLessThan(0.02)
  })

  it('tilt toward the user lowers the front edge', () => {
    expect(capTiltRise(key('F5'))).toBeGreaterThan(0)
    expect(capTiltRise(key('KeyG'))).toBe(0)
    expect(capTiltRise(key('Space'))).toBeLessThan(0)
  })
})
