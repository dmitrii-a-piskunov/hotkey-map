import { describe, expect, it } from 'vitest'
import {
  clickSelect,
  emptySelection,
  marqueeSelect,
  navigate,
  neighbor,
  planInputs,
  rangeSelect,
  rectSelect,
  selectAll,
  selectableKeys,
  type SelectionState,
} from '@/domain/selection'
import { MOUSE_ROW_KEYS } from '@/features/devices/devices'
import { aulaF75 } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'

const inputs = planInputs(aulaF75, mouse2Side, MOUSE_ROW_KEYS)

const plain = { ctrl: false, shift: false }
const ctrl = { ctrl: true, shift: false }
const shift = { ctrl: false, shift: true }
const ctrlShift = { ctrl: true, shift: true }

function click(state: SelectionState, code: string, mods = plain): SelectionState {
  return clickSelect(state, code, mods, inputs)
}

describe('rangeSelect', () => {
  it('Q → D gives exactly Q W E A S D (FR-13)', () => {
    expect(rangeSelect(inputs, 'KeyQ', 'KeyD').sort()).toEqual(
      ['KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyS', 'KeyW'].sort(),
    )
  })

  it('works in reverse direction', () => {
    expect(rangeSelect(inputs, 'KeyD', 'KeyQ').sort()).toEqual(
      rangeSelect(inputs, 'KeyQ', 'KeyD').sort(),
    )
  })

  it('single key range is the key itself', () => {
    expect(rangeSelect(inputs, 'KeyF', 'KeyF')).toEqual(['KeyF'])
  })

  it('never includes Fn', () => {
    expect(rangeSelect(inputs, 'Space', 'ControlRight')).toEqual(['Space', 'ControlRight'])
  })

  it('returns nothing for unknown codes', () => {
    const range = rangeSelect(inputs, 'KeyQ', 'MouseLeft')
    expect(range).toEqual(expect.arrayContaining(['KeyQ', 'Delete', 'Mouse5', 'MouseLeft']))
    expect(range).not.toContain('KeyA')
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

  it('Shift ranges span the keyboard and the mouse', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'MouseRight', shift)
    expect(s.selected).toEqual(expect.arrayContaining(['KeyQ', 'PageUp', 'Mouse5', 'MouseRight']))
    s = click(emptySelection, 'MouseLeft')
    s = click(s, 'MouseRight', shift)
    expect([...s.selected].sort()).toEqual(
      ['MouseLeft', 'MouseMiddle', 'MouseRight', 'WheelDown', 'WheelUp'].sort(),
    )
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
    const base = click(emptySelection, 'KeyX')
    expect(marqueeSelect(base, ['KeyA', 'MouseLeft'], false)).toEqual({
      selected: ['KeyA', 'MouseLeft'],
      anchor: 'KeyA',
      focus: 'KeyA',
    })
    expect(marqueeSelect(base, [], false)).toEqual(emptySelection)
  })

  it('adds to selection with Ctrl', () => {
    const base = click(emptySelection, 'KeyX')
    expect(marqueeSelect(base, ['KeyA', 'KeyX'], true).selected).toEqual(['KeyX', 'KeyA'])
  })
})

describe('neighbor', () => {
  it('moves within a row', () => {
    expect(neighbor(inputs, 'KeyQ', 'right')).toBe('KeyW')
    expect(neighbor(inputs, 'KeyQ', 'left')).toBe('Tab')
  })

  it('stays at the edge', () => {
    expect(neighbor(inputs, 'Tab', 'left')).toBe('Tab')
    expect(neighbor(inputs, 'Escape', 'up')).toBe('Escape')
    expect(neighbor(inputs, 'ArrowRight', 'right')).toBe('ArrowRight')
  })

  it('moves to the closest key in the next row', () => {
    expect(neighbor(inputs, 'KeyQ', 'down')).toBe('KeyA')
    expect(neighbor(inputs, 'KeyA', 'up')).toBe('KeyQ')
    expect(neighbor(inputs, 'ArrowUp', 'down')).toBe('ArrowDown')
  })

  it('skips Fn', () => {
    expect(neighbor(inputs, 'Space', 'right')).toBe('ControlRight')
    expect(neighbor(inputs, 'Slash', 'down')).not.toBe('Fn')
  })

  it('returns the code unchanged for unknown keys', () => {
    expect(neighbor(inputs, 'Unknown', 'right')).toBe('Unknown')
  })

  it('moves between the keyboard and the mouse', () => {
    expect(neighbor(inputs, 'Delete', 'right')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'left')).toBe('Delete')
    expect(neighbor(inputs, 'MouseLeft', 'right')).toMatch(/^(WheelUp|MouseMiddle|WheelDown)$/)
    expect(neighbor(inputs, 'MouseLeft', 'down')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'down')).toBe('Mouse4')
  })

  it('treats ЛКМ, Mouse 5 and Mouse 4 as keys in the F12, Delete and PgUp rows', () => {
    expect(neighbor(inputs, 'F12', 'right')).toBe('MouseLeft')
    expect(neighbor(inputs, 'MouseLeft', 'left')).toBe('F12')
    expect(neighbor(inputs, 'PageUp', 'right')).toBe('Mouse4')
    expect(neighbor(inputs, 'Mouse4', 'left')).toBe('PageUp')
    expect(neighbor(inputs, 'Mouse5', 'up')).toBe('MouseLeft')
    expect(neighbor(inputs, 'Mouse4', 'up')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'right')).toBe('MouseLeft')
  })

  it('keeps moves between ЛКМ, the wheel and ПКМ as they were', () => {
    const plain = planInputs(aulaF75, mouse2Side)
    for (const code of ['MouseLeft', 'MouseMiddle', 'WheelUp', 'WheelDown', 'MouseRight']) {
      for (const dir of ['right', 'up', 'down'] as const) {
        expect(neighbor(inputs, code, dir), `${code} ${dir}`).toBe(neighbor(plain, code, dir))
      }
    }
    for (const code of ['MouseMiddle', 'WheelUp', 'WheelDown', 'MouseRight']) {
      expect(neighbor(inputs, code, 'left'), code).toBe(neighbor(plain, code, 'left'))
    }
  })
})

describe('navigate', () => {
  it('TC-14: select Q, Shift+→ twice selects Q W E', () => {
    let s = click(emptySelection, 'KeyQ')
    s = navigate(s, 'right', true, inputs)
    s = navigate(s, 'right', true, inputs)
    expect(s.selected).toEqual(['KeyQ', 'KeyW', 'KeyE'])
    expect(s.selected).not.toContain('ArrowRight')
    expect(s.anchor).toBe('KeyQ')
    expect(s.focus).toBe('KeyE')
  })

  it('arrow without Shift moves single selection', () => {
    let s = click(emptySelection, 'KeyQ')
    s = navigate(s, 'down', false, inputs)
    expect(s).toEqual({ selected: ['KeyA'], anchor: 'KeyA', focus: 'KeyA' })
  })

  it('Shift+↓ extends to a rectangle', () => {
    let s = click(emptySelection, 'KeyW')
    s = navigate(s, 'right', true, inputs)
    s = navigate(s, 'down', true, inputs)
    expect([...s.selected].sort()).toEqual(['KeyD', 'KeyE', 'KeyS', 'KeyW'].sort())
  })

  it('starts from the first key when nothing is focused', () => {
    expect(navigate(emptySelection, 'right', false, inputs).selected).toEqual(['Escape'])
  })

  it('Shift+arrows Mouse 5 → left button → wheel keep the left button', () => {
    let s = click(emptySelection, 'Mouse5')
    s = navigate(s, 'right', true, inputs)
    expect([...s.selected].sort()).toEqual(['Mouse5', 'MouseLeft'])
    s = navigate(s, 'right', true, inputs)
    expect([...s.selected].sort()).toEqual(
      ['Mouse5', 'MouseLeft', 'MouseMiddle', 'WheelDown', 'WheelUp'].sort(),
    )
  })

  it('Shift+arrows extend from a mouse input', () => {
    const s = click(emptySelection, 'MouseLeft')
    expect(navigate(s, 'down', true, inputs).selected).toEqual(['MouseLeft', 'Mouse5'])
    expect(navigate(s, 'left', true, inputs).selected).toEqual(['F12', 'MouseLeft'])
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
  it('has 78 selectable keys of 80 (all but Fn and Win)', () => {
    expect(aulaF75.keys).toHaveLength(80)
    expect(selectableKeys(aulaF75)).toHaveLength(78)
  })
})
