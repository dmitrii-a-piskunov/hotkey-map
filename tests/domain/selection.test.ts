import { describe, expect, it } from 'vitest'
import {
  clickSelect,
  emptySelection,
  marqueeSelect,
  navigate,
  neighbor,
  rangeSelect,
  rectSelect,
  selectAll,
  selectableKeys,
  type SelectionState,
} from '@/domain/selection'
import { aulaF75 } from '@/layouts/aula-f75'

const plain = { ctrl: false, shift: false }
const ctrl = { ctrl: true, shift: false }
const shift = { ctrl: false, shift: true }
const ctrlShift = { ctrl: true, shift: true }

function click(state: SelectionState, code: string, mods = plain): SelectionState {
  return clickSelect(state, code, mods, aulaF75)
}

describe('rangeSelect', () => {
  it('Q → D gives exactly Q W E A S D (FR-13)', () => {
    expect(rangeSelect(aulaF75, 'KeyQ', 'KeyD').sort()).toEqual(
      ['KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyS', 'KeyW'].sort(),
    )
  })

  it('works in reverse direction', () => {
    expect(rangeSelect(aulaF75, 'KeyD', 'KeyQ').sort()).toEqual(
      rangeSelect(aulaF75, 'KeyQ', 'KeyD').sort(),
    )
  })

  it('single key range is the key itself', () => {
    expect(rangeSelect(aulaF75, 'KeyF', 'KeyF')).toEqual(['KeyF'])
  })

  it('never includes Fn', () => {
    expect(rangeSelect(aulaF75, 'AltRight', 'ControlRight')).toEqual(['AltRight', 'ControlRight'])
  })

  it('returns nothing for unknown codes', () => {
    expect(rangeSelect(aulaF75, 'KeyQ', 'MouseLeft')).toEqual([])
  })
})

describe('clickSelect', () => {
  it('TC-06: click Q, Shift+click D, Ctrl+click F selects Q W E A S D F', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'KeyD', shift)
    s = click(s, 'KeyF', ctrl)
    expect([...s.selected].sort()).toEqual(
      ['KeyA', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyS', 'KeyW'].sort(),
    )
  })

  it('plain click replaces selection', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'KeyW', ctrl)
    s = click(s, 'KeyE')
    expect(s).toEqual({ selected: ['KeyE'], anchor: 'KeyE', focus: 'KeyE' })
  })

  it('Ctrl+click on a selected key removes only that key', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'KeyD', shift)
    s = click(s, 'KeyW', ctrl)
    expect([...s.selected].sort()).toEqual(['KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyS'].sort())
  })

  it('Shift+click keeps the anchor for the next Shift+click', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'KeyD', shift)
    s = click(s, 'KeyW', shift)
    expect(s.selected).toEqual(['KeyQ', 'KeyW'])
    expect(s.anchor).toBe('KeyQ')
  })

  it('Shift+click without anchor acts as plain click', () => {
    expect(click(emptySelection, 'KeyD', shift).selected).toEqual(['KeyD'])
  })

  it('Ctrl+Shift+click adds range to selection', () => {
    let s = click(emptySelection, 'KeyP')
    s = click(s, 'KeyQ', ctrl)
    s = click(s, 'KeyE', ctrlShift)
    expect([...s.selected].sort()).toEqual(['KeyE', 'KeyP', 'KeyQ', 'KeyW'].sort())
  })

  it('mouse inputs are selected by click and Ctrl+click', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'MouseLeft', ctrl)
    expect(s.selected).toEqual(['KeyQ', 'MouseLeft'])
    s = click(s, 'Mouse4')
    expect(s.selected).toEqual(['Mouse4'])
  })

  it('mouse inputs do not take part in Shift ranges', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'MouseRight', shift)
    expect(s.selected).toEqual(['MouseRight'])
    s = click(s, 'KeyD', shift)
    expect(s.selected).toEqual(['KeyD'])
  })

  it('Fn cannot be selected', () => {
    const s = click(emptySelection, 'KeyQ')
    expect(click(s, 'Fn')).toBe(s)
    expect(click(s, 'Fn', ctrl)).toBe(s)
  })
})

describe('rectSelect and marqueeSelect', () => {
  const items = [
    { code: 'A', rect: { x: 0, y: 0, w: 10, h: 10 } },
    { code: 'B', rect: { x: 20, y: 0, w: 10, h: 10 } },
    { code: 'C', rect: { x: 0, y: 20, w: 10, h: 10 } },
  ]

  it('selects items intersecting the area', () => {
    expect(rectSelect(items, { x: 5, y: 5, w: 20, h: 2 })).toEqual(['A', 'B'])
    expect(rectSelect(items, { x: 11, y: 11, w: 5, h: 5 })).toEqual([])
  })

  it('replaces selection without Ctrl', () => {
    const base = click(emptySelection, 'X')
    expect(marqueeSelect(base, ['A', 'B'], false)).toEqual({
      selected: ['A', 'B'],
      anchor: 'A',
      focus: 'A',
    })
    expect(marqueeSelect(base, [], false)).toEqual(emptySelection)
  })

  it('adds to selection with Ctrl', () => {
    const base = click(emptySelection, 'X')
    expect(marqueeSelect(base, ['A', 'X'], true).selected).toEqual(['X', 'A'])
  })
})

describe('neighbor', () => {
  it('moves within a row', () => {
    expect(neighbor(aulaF75, 'KeyQ', 'right')).toBe('KeyW')
    expect(neighbor(aulaF75, 'KeyQ', 'left')).toBe('Tab')
  })

  it('stays at the edge', () => {
    expect(neighbor(aulaF75, 'Tab', 'left')).toBe('Tab')
    expect(neighbor(aulaF75, 'Escape', 'up')).toBe('Escape')
    expect(neighbor(aulaF75, 'ArrowRight', 'right')).toBe('ArrowRight')
  })

  it('moves to the closest key in the next row', () => {
    expect(neighbor(aulaF75, 'KeyQ', 'down')).toBe('KeyA')
    expect(neighbor(aulaF75, 'KeyA', 'up')).toBe('KeyQ')
    expect(neighbor(aulaF75, 'ArrowUp', 'down')).toBe('ArrowDown')
  })

  it('skips Fn', () => {
    expect(neighbor(aulaF75, 'AltRight', 'right')).toBe('ControlRight')
    expect(neighbor(aulaF75, 'Slash', 'down')).not.toBe('Fn')
  })

  it('returns the code unchanged for unknown keys', () => {
    expect(neighbor(aulaF75, 'MouseLeft', 'right')).toBe('MouseLeft')
  })
})

describe('navigate', () => {
  it('TC-14: select Q, Shift+→ twice selects Q W E', () => {
    let s = click(emptySelection, 'KeyQ')
    s = navigate(s, 'right', true, aulaF75)
    s = navigate(s, 'right', true, aulaF75)
    expect(s.selected).toEqual(['KeyQ', 'KeyW', 'KeyE'])
    expect(s.selected).not.toContain('ArrowRight')
    expect(s.anchor).toBe('KeyQ')
    expect(s.focus).toBe('KeyE')
  })

  it('arrow without Shift moves single selection', () => {
    let s = click(emptySelection, 'KeyQ')
    s = navigate(s, 'down', false, aulaF75)
    expect(s).toEqual({ selected: ['KeyA'], anchor: 'KeyA', focus: 'KeyA' })
  })

  it('Shift+↓ extends to a rectangle', () => {
    let s = click(emptySelection, 'KeyW')
    s = navigate(s, 'right', true, aulaF75)
    s = navigate(s, 'down', true, aulaF75)
    expect([...s.selected].sort()).toEqual(['KeyD', 'KeyE', 'KeyS', 'KeyW'].sort())
  })

  it('starts from the first key when nothing is focused', () => {
    expect(navigate(emptySelection, 'right', false, aulaF75).selected).toEqual(['Escape'])
  })

  it('starts from the first key when focus is a mouse input', () => {
    const s = click(emptySelection, 'MouseLeft')
    expect(navigate(s, 'left', true, aulaF75).selected).toEqual(['Escape'])
  })
})

describe('selectAll', () => {
  it('selects occupied keys', () => {
    expect(selectAll(['KeyQ', 'KeyW'])).toEqual({
      selected: ['KeyQ', 'KeyW'],
      anchor: 'KeyQ',
      focus: 'KeyQ',
    })
    expect(selectAll([])).toEqual(emptySelection)
  })
})

describe('selectableKeys', () => {
  it('has 80 selectable keys of 81 (all but Fn)', () => {
    expect(aulaF75.keys).toHaveLength(81)
    expect(selectableKeys(aulaF75)).toHaveLength(80)
  })
})
