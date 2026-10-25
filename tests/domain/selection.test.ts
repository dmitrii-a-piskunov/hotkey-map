import { describe, expect, it } from 'vitest'
import {
  clickSelect,
  emptySelection,
  marqueeSelect,
  sameSelection,
  navigate,
  neighbor,
  planInputs,
  rangeSelect,
  rectSelect,
  selectAll,
  type SelectionState,
} from '@/domain/selection'
import { MOUSE_ROWS } from '@/features/devices/devices'
import { aulaF75, KNOB_CODE } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'

const inputs = planInputs(aulaF75, mouse2Side, MOUSE_ROWS)

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

  it('includes Fn, Win and the knob when the rectangle crosses them', () => {
    expect(rangeSelect(inputs, 'Space', 'ControlRight')).toEqual(['Space', 'Fn', 'ControlRight'])
    expect(rangeSelect(inputs, 'ControlLeft', 'AltLeft')).toContain('MetaLeft')
    expect(rangeSelect(inputs, 'F12', 'MouseLeft')).toEqual(['F12', KNOB_CODE, 'MouseLeft'])
  })

  it('follows finger columns, not coordinates: C → 4 is the middle finger column', () => {
    expect(rangeSelect(inputs, 'KeyC', 'Digit4').sort()).toEqual(
      ['Digit4', 'KeyC', 'KeyD', 'KeyE'].sort(),
    )
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

  it('plain click on Fn or the knob changes nothing; Win is a usual key', () => {
    const s = click(emptySelection, 'KeyQ')
    expect(click(s, 'Fn')).toBe(s)
    expect(click(s, KNOB_CODE)).toBe(s)
    expect(click(s, 'MetaLeft').selected).toEqual(['MetaLeft'])
  })

  it('Ctrl+click adds and removes Fn; a plain click does not clear it', () => {
    let s = click(emptySelection, 'KeyQ')
    s = click(s, 'Fn', ctrl)
    expect(s.selected).toEqual(['KeyQ', 'Fn'])
    expect(click(s, 'Fn')).toBe(s)
    s = click(s, 'Fn', ctrl)
    expect(s.selected).toEqual(['KeyQ'])
  })

  it('Shift+click to Fn selects the range including it', () => {
    let s = click(emptySelection, 'Period')
    s = click(s, 'Fn', shift)
    expect([...s.selected].sort()).toEqual(['Fn', 'Period'])
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

describe('sameSelection', () => {
  const sel = { selected: ['KeyQ', 'KeyW'], anchor: 'KeyQ', focus: 'KeyQ' }
  it('is true for equal selections in another object', () => {
    expect(sameSelection(sel, { ...sel, selected: ['KeyQ', 'KeyW'] })).toBe(true)
  })
  it('is false when keys, their order, anchor or column differ', () => {
    expect(sameSelection(sel, { ...sel, selected: ['KeyQ'] })).toBe(false)
    expect(sameSelection(sel, { ...sel, selected: ['KeyW', 'KeyQ'] })).toBe(false)
    expect(sameSelection(sel, { ...sel, anchor: 'KeyW' })).toBe(false)
    expect(sameSelection(sel, { ...sel, focusCol: 2 })).toBe(false)
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

  it('stops on Fn, Win and the knob', () => {
    expect(neighbor(inputs, 'Space', 'right')).toBe('Fn')
    expect(neighbor(inputs, 'Period', 'down')).toBe('Fn')
    expect(neighbor(inputs, 'ControlLeft', 'right')).toBe('MetaLeft')
    expect(neighbor(inputs, 'Delete', 'up')).toBe(KNOB_CODE)
  })

  it('up follows the finger column', () => {
    const column = (start: string, steps: number) => {
      let s = click(emptySelection, start)
      const codes = [start]
      for (let i = 0; i < steps; i++) {
        s = navigate(s, 'up', false, inputs)
        codes.push(s.focus ?? '')
      }
      return codes
    }
    expect(column('KeyC', 3)).toEqual(['KeyC', 'KeyD', 'KeyE', 'Digit4'])
    expect(column('KeyB', 3)).toEqual(['KeyB', 'KeyG', 'KeyT', 'Digit6'])
    expect(column('KeyN', 3)).toEqual(['KeyN', 'KeyH', 'KeyY', 'Digit7'])
    expect(column('KeyZ', 3)).toEqual(['KeyZ', 'KeyA', 'KeyQ', 'Digit2'])
    expect(column('Slash', 3)).toEqual(['Slash', 'Semicolon', 'KeyP', 'Digit0'])
  })

  it('an empty cell goes to the nearest key of the row', () => {
    expect(neighbor(inputs, 'Digit0', 'up')).toBe('F9')
    expect(neighbor(inputs, 'Digit1', 'up')).toBe('Escape')
  })

  it('returns the code unchanged for unknown keys', () => {
    expect(neighbor(inputs, 'Unknown', 'right')).toBe('Unknown')
  })

  it('moves between the keyboard and the mouse', () => {
    expect(neighbor(inputs, 'Delete', 'right')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'left')).toBe('Delete')
    expect(neighbor(inputs, 'MouseLeft', 'right')).toBe('MouseMiddle')
    expect(neighbor(inputs, 'MouseRight', 'left')).toBe('MouseMiddle')
    expect(neighbor(inputs, 'MouseLeft', 'down')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'down')).toBe('Mouse4')
  })

  it('treats ЛКМ, Mouse 5 and Mouse 4 as keys in the F12, Delete and PgUp rows', () => {
    expect(neighbor(inputs, 'F12', 'right')).toBe(KNOB_CODE)
    expect(neighbor(inputs, KNOB_CODE, 'right')).toBe('MouseLeft')
    expect(neighbor(inputs, 'MouseLeft', 'left')).toBe(KNOB_CODE)
    expect(neighbor(inputs, 'PageUp', 'right')).toBe('Mouse4')
    expect(neighbor(inputs, 'Mouse4', 'left')).toBe('PageUp')
    expect(neighbor(inputs, 'Mouse5', 'up')).toBe('MouseLeft')
    expect(neighbor(inputs, 'Mouse4', 'up')).toBe('Mouse5')
    expect(neighbor(inputs, 'Mouse5', 'right')).toBe('MouseLeft')
  })

  it('moves inside the mouse by button position, ←/→ land on the wheel press', () => {
    // Переходы внутри мыши: ←/→ между кнопками и колесом ведут на нажатие колеса
    const expected: Record<string, Record<'left' | 'right' | 'up' | 'down', string>> = {
      MouseLeft: { left: KNOB_CODE, right: 'MouseMiddle', up: 'MouseLeft', down: 'Mouse5' },
      Mouse5: { left: 'Delete', right: 'MouseLeft', up: 'MouseLeft', down: 'Mouse4' },
      Mouse4: { left: 'PageUp', right: 'Mouse4', up: 'Mouse5', down: 'Mouse4' },
      MouseRight: {
        left: 'MouseMiddle',
        right: 'MouseRight',
        up: 'MouseRight',
        down: 'MouseRight',
      },
      MouseMiddle: { left: 'MouseLeft', right: 'MouseRight', up: 'WheelUp', down: 'WheelDown' },
      WheelUp: { left: 'MouseLeft', right: 'MouseRight', up: 'WheelUp', down: 'MouseMiddle' },
      WheelDown: { left: 'MouseLeft', right: 'MouseRight', up: 'MouseMiddle', down: 'WheelDown' },
    }
    for (const [code, dirs] of Object.entries(expected)) {
      for (const [dir, to] of Object.entries(dirs)) {
        expect(neighbor(inputs, code, dir as 'left'), `${code} ${dir}`).toBe(to)
      }
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
    expect(s).toMatchObject({ selected: ['KeyA'], anchor: 'KeyA', focus: 'KeyA' })
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

  it('Shift+↓ from F12 keeps the column through keys of different width', () => {
    let s = click(emptySelection, 'F12')
    const steps: [string, string[]][] = [
      ['Backspace', ['F12', 'Backspace']],
      ['Backslash', ['F12', 'Backspace', 'Backslash']],
      ['Enter', ['F12', 'Backspace', 'Backslash', 'Enter']],
      ['ArrowUp', ['F12', 'Backspace', 'Backslash', 'Enter', 'ArrowUp']],
      ['ArrowDown', ['F12', 'Backspace', 'Backslash', 'Enter', 'ArrowUp', 'ArrowDown']],
    ]
    for (const [focus, selected] of steps) {
      s = navigate(s, 'down', true, inputs)
      expect(s.focus).toBe(focus)
      expect([...s.selected].sort()).toEqual([...selected].sort())
    }
  })

  it('the mouse continues keyboard rows: ЛКМ ← ← ← ↓ gives a two-row rectangle', () => {
    let s = click(emptySelection, 'MouseLeft')
    for (let i = 0; i < 3; i++) s = navigate(s, 'left', true, inputs)
    expect([...s.selected].sort()).toEqual(['F11', 'F12', KNOB_CODE, 'MouseLeft'].sort())
    s = navigate(s, 'down', true, inputs)
    expect(s.focus).toBe('Backspace')
    expect([...s.selected].sort()).toEqual(
      ['F11', 'F12', KNOB_CODE, 'MouseLeft', 'Backspace', 'Delete', 'Mouse5'].sort(),
    )
  })

  it('Shift+← adds one grid column per press: a two-column finger zone takes two', () => {
    let s = click(emptySelection, 'Slash')
    for (let i = 0; i < 3; i++) s = navigate(s, 'up', true, inputs)
    for (let i = 0; i < 3; i++) s = navigate(s, 'left', true, inputs)
    expect(s.selected).toHaveLength(16)
    const before = new Set(s.selected)
    const added = (next: SelectionState) => next.selected.filter((code) => !before.has(code)).sort()

    s = navigate(s, 'left', true, inputs)
    expect(added(s)).toEqual(['KeyH', 'KeyN', 'KeyY'])
    s = navigate(s, 'left', true, inputs)
    expect(added(s)).toEqual(['Digit6', 'KeyB', 'KeyG', 'KeyH', 'KeyN', 'KeyT', 'KeyY'])
    s = navigate(s, 'right', true, inputs)
    expect(added(s)).toEqual(['KeyH', 'KeyN', 'KeyY'])
  })

  it('Shift+← on a wide key keeps the cursor on it until its edge', () => {
    let s = click(emptySelection, 'Digit2')
    for (let i = 0; i < 3; i++) s = navigate(s, 'down', true, inputs)
    s = navigate(s, 'left', true, inputs)
    expect([...s.selected].sort()).toEqual(
      ['CapsLock', 'Digit1', 'Digit2', 'KeyA', 'KeyQ', 'KeyZ', 'ShiftLeft', 'Tab'].sort(),
    )
    expect(navigate(s, 'down', true, inputs).focus).toBe('MetaLeft')

    s = navigate(s, 'left', true, inputs)
    expect(s.focus).toBe('ShiftLeft')
    expect(s.selected).toHaveLength(9)
    expect(s.selected).toContain('Backquote')

    const down = navigate(s, 'down', true, inputs)
    expect(down.focus).toBe('ControlLeft')
    expect(navigate(down, 'up', true, inputs).selected).toEqual(s.selected)
    expect(navigate(s, 'right', true, inputs).selected).not.toContain('Backquote')
  })

  it('Shift+→ passes columns inside Space that change nothing', () => {
    let s = click(emptySelection, 'Space')
    s = navigate(s, 'right', true, inputs)
    expect(s.selected).toEqual(['Space', 'Fn'])
    s = navigate(s, 'left', true, inputs)
    expect(s.selected).toEqual(['Space'])
    s = navigate(s, 'left', true, inputs)
    expect(s.selected).toEqual(['AltLeft', 'Space'])
  })

  it('Space remembers the column it was entered from', () => {
    let s = click(emptySelection, 'KeyV')
    s = navigate(s, 'down', false, inputs)
    expect(s.focus).toBe('Space')
    s = navigate(s, 'up', false, inputs)
    expect(s.focus).toBe('KeyV')
    s = click(emptySelection, 'Period')
    s = navigate(s, 'down', false, inputs)
    s = navigate(s, 'left', false, inputs)
    expect(s.focus).toBe('Space')
    s = navigate(s, 'up', false, inputs)
    expect(s.focus).toBe('Comma')
  })

  it('↓ without Shift keeps the column too', () => {
    let s = click(emptySelection, 'F12')
    for (let i = 0; i < 3; i++) s = navigate(s, 'down', false, inputs)
    expect(s.selected).toEqual(['Enter'])
    s = navigate(s, 'down', false, inputs)
    expect(s.selected).toEqual(['ArrowUp'])
  })

  it('Shift+arrows extend from a mouse input', () => {
    const s = click(emptySelection, 'MouseLeft')
    expect(navigate(s, 'down', true, inputs).selected).toEqual(['MouseLeft', 'Mouse5'])
    expect(navigate(s, 'left', true, inputs).selected).toEqual([KNOB_CODE, 'MouseLeft'])
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

describe('navigation grid', () => {
  it('has every key and the knob; Fn and the knob are blocked', () => {
    expect(aulaF75.keys).toHaveLength(80)
    const keyboard = inputs.filter((i) => i.device === 'keyboard')
    expect(keyboard).toHaveLength(81)
    expect(keyboard.filter((i) => i.blocked).map((i) => i.code)).toEqual(['Fn', KNOB_CODE])
  })

  it('puts each key in one row of the grid, in adjacent cells', () => {
    const known = new Set([...aulaF75.keys.map((k) => k.code), KNOB_CODE])
    const seen = new Map<string, number>()
    aulaF75.navGrid.forEach((row, line) => {
      row.forEach((code, col) => {
        if (code === null) return
        expect(known.has(code), code).toBe(true)
        const firstLine = seen.get(code)
        if (firstLine === undefined) seen.set(code, line)
        else {
          expect(firstLine, code).toBe(line)
          expect(row[col - 1], code).toBe(code)
        }
      })
    })
    expect(seen.size).toBe(known.size)
  })

  it('places the mouse to the right: M5 and M4, then ЛКМ, wheel and ПКМ', () => {
    const col = (code: string) => inputs.find((i) => i.code === code)?.cols[0]
    const cols = ['Mouse5', 'Mouse4', 'MouseLeft', 'WheelUp', 'MouseRight'].map(col)
    expect(cols).toEqual([17, 17, 18, 19, 20])
  })
})
