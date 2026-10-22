import { describe, expect, it } from 'vitest'
import {
  drawPlan,
  ICON_MAX_BYTES,
  iconFileError,
  iconFileName,
  referencedIcons,
  steamImageUrl,
  unusedIcons,
} from '@/domain/icons'

describe('icon files (FR-05, section 12)', () => {
  it('accepts PNG, JPG, WebP and ICO up to 1 MB and rejects SVG', () => {
    expect(iconFileError({ type: 'image/png', size: 1000 })).toBeNull()
    expect(iconFileError({ type: 'image/jpeg', size: ICON_MAX_BYTES })).toBeNull()
    expect(iconFileError({ type: 'image/webp', size: 10 })).toBeNull()
    expect(iconFileError({ type: 'image/x-icon', size: 10 })).toBeNull()
    expect(iconFileError({ type: 'image/svg+xml', size: 10 })).toBe('type')
    expect(iconFileError({ type: 'image/gif', size: 10 })).toBe('type')
    expect(iconFileError({ type: 'image/png', size: ICON_MAX_BYTES + 1 })).toBe('size')
  })

  it('falls back to the extension when the type is empty', () => {
    expect(iconFileError({ type: '', size: 10, name: 'game.ICO' })).toBeNull()
    expect(iconFileError({ type: '', size: 10, name: 'game.svg' })).toBe('type')
    expect(iconFileError({ type: '', size: 10 })).toBe('type')
  })

  it('names icons by game and a fresh id', () => {
    expect(iconFileName('game-id', '0123456789abcdef')).toBe('game-id-01234567.png')
  })

  it('builds Steam CDN addresses', () => {
    expect(steamImageUrl(570, 'header')).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg',
    )
    expect(steamImageUrl(570, 'library')).toMatch(/library_600x900\.jpg$/)
    expect(steamImageUrl(570, 'logo')).toMatch(/logo\.png$/)
  })
})

describe('drawPlan', () => {
  it('center crops a wide picture', () => {
    expect(drawPlan(460, 215, 'center', 128)).toEqual({
      sx: 122.5,
      sy: 0,
      sw: 215,
      sh: 215,
      dx: 0,
      dy: 0,
      dw: 128,
      dh: 128,
    })
  })

  it('takes the top square of a tall picture', () => {
    expect(drawPlan(600, 900, 'top', 128)).toMatchObject({ sx: 0, sy: 0, sw: 600, sh: 600 })
    expect(drawPlan(600, 900, 'center', 128)).toMatchObject({ sy: 150 })
  })

  it('fits a logo inside with padding', () => {
    const plan = drawPlan(400, 100, 'contain', 128, 8)
    expect(plan).toMatchObject({ sw: 400, sh: 100, dy: 50 })
    expect(plan.dx).toBeCloseTo(8)
    expect(plan.dw).toBeCloseTo(112)
    expect(plan.dh).toBeCloseTo(28)
  })
})

describe('unused icons', () => {
  const data = (icons: (string | undefined)[]) =>
    JSON.stringify({ schemaVersion: 1, games: icons.map((icon) => ({ icon })) })

  it('reads icon references loosely', () => {
    expect(referencedIcons(data(['a.png', undefined]))).toEqual(new Set(['a.png']))
    expect(referencedIcons('{')).toBeNull()
    expect(referencedIcons('{"games": 1}')).toBeNull()
  })

  it('keeps icons referenced by data.json or any backup', () => {
    const files = ['a.png', 'b.png', 'c.png']
    expect(unusedIcons(files, [data(['a.png']), data(['b.png'])])).toEqual(['c.png'])
  })

  it('deletes nothing if some text cannot be read', () => {
    expect(unusedIcons(['a.png'], [data([]), 'not json'])).toEqual([])
  })
})
