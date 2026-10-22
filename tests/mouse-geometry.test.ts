import { describe, expect, it } from 'vitest'
import { boundsOf } from '@/components/devices/projection'
import { mouseScene } from '@/components/mouse/mouse-geometry'
import { mouse2Side } from '@/layouts/mouse'

/** Насколько дуга линии раздела глубже в центре, чем у боков, в долях высоты рисунка */
function curveDepth(view: '2d' | '3d'): number {
  const scene = mouseScene(mouse2Side, view)
  const split = scene.seams.slice(0, -1).flat()
  const ys = split.map((p) => p.y)
  const edgeY = split[0]?.y ?? 0
  return (Math.max(...ys) - edgeY) / boundsOf(scene.outline).h
}

describe('mouse buttons split line', () => {
  it('bulges backwards and is flatter in 3D than in 2D', () => {
    const flat = curveDepth('2d')
    const tilted = curveDepth('3d')
    expect(flat).toBeGreaterThan(0)
    expect(tilted).toBeGreaterThan(0)
    expect(tilted).toBeLessThan(flat)
  })

  it('clips the click zones of ЛКМ and ПКМ to their outline, other zones stay boxes', () => {
    for (const view of ['2d', '3d'] as const) {
      const zones = mouseScene(mouse2Side, view).zones
      const clipped = zones.filter((z) => z.clip).map((z) => z.input.code)
      expect(clipped).toEqual(['MouseLeft', 'MouseRight'])
      for (const z of zones) {
        if (z.clip) expect(boundsOf(z.clip)).toEqual(z.box)
      }
    }
  })
})
