import { describe, expect, it } from 'vitest'
import {
  arrowDirection,
  detectLabelLang,
  isModifierCode,
  isReservedCombo,
  mouseCodeForButton,
  mouseCodeForWheel,
} from '@/domain/input'
import { mouse2Side } from '@/layouts/mouse'

const combo = (
  code: string,
  mods: Partial<{ ctrl: boolean; alt: boolean; meta: boolean }> = {},
) => ({
  code,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  metaKey: mods.meta ?? false,
})

describe('isReservedCombo', () => {
  it('lets the browser handle Ctrl+W/T/N, Alt+F4 and Win', () => {
    expect(isReservedCombo(combo('KeyW', { ctrl: true }))).toBe(true)
    expect(isReservedCombo(combo('KeyT', { ctrl: true }))).toBe(true)
    expect(isReservedCombo(combo('KeyN', { ctrl: true }))).toBe(true)
    expect(isReservedCombo(combo('F4', { alt: true }))).toBe(true)
    expect(isReservedCombo(combo('MetaLeft'))).toBe(true)
    expect(isReservedCombo(combo('KeyE', { meta: true }))).toBe(true)
  })

  it('captures everything else', () => {
    expect(isReservedCombo(combo('KeyW'))).toBe(false)
    expect(isReservedCombo(combo('F5'))).toBe(false)
    expect(isReservedCombo(combo('F4'))).toBe(false)
    expect(isReservedCombo(combo('KeyR', { ctrl: true }))).toBe(false)
  })
})

describe('isModifierCode', () => {
  it('detects modifiers', () => {
    expect(isModifierCode('ShiftLeft')).toBe(true)
    expect(isModifierCode('ControlRight')).toBe(true)
    expect(isModifierCode('AltLeft')).toBe(true)
    expect(isModifierCode('KeyA')).toBe(false)
  })
})

describe('arrowDirection', () => {
  it('maps arrows', () => {
    expect(arrowDirection('ArrowUp')).toBe('up')
    expect(arrowDirection('ArrowDown')).toBe('down')
    expect(arrowDirection('ArrowLeft')).toBe('left')
    expect(arrowDirection('ArrowRight')).toBe('right')
    expect(arrowDirection('KeyW')).toBeNull()
  })
})

describe('detectLabelLang', () => {
  it('detects Cyrillic and Latin letters', () => {
    expect(detectLabelLang('й')).toBe('ru')
    expect(detectLabelLang('Ё')).toBe('ru')
    expect(detectLabelLang('q')).toBe('en')
    expect(detectLabelLang('Q')).toBe('en')
  })

  it('ignores other keys', () => {
    expect(detectLabelLang('1')).toBeNull()
    expect(detectLabelLang(' ')).toBeNull()
    expect(detectLabelLang('Shift')).toBeNull()
    expect(detectLabelLang('Enter')).toBeNull()
  })
})

describe('mouse codes', () => {
  it('maps buttons', () => {
    expect(mouseCodeForButton(mouse2Side, 0)).toBe('MouseLeft')
    expect(mouseCodeForButton(mouse2Side, 1)).toBe('MouseMiddle')
    expect(mouseCodeForButton(mouse2Side, 2)).toBe('MouseRight')
    expect(mouseCodeForButton(mouse2Side, 3)).toBe('Mouse4')
    expect(mouseCodeForButton(mouse2Side, 4)).toBe('Mouse5')
    expect(mouseCodeForButton(mouse2Side, 7)).toBeNull()
  })

  it('maps wheel direction', () => {
    expect(mouseCodeForWheel(mouse2Side, -100)).toBe('WheelUp')
    expect(mouseCodeForWheel(mouse2Side, 53)).toBe('WheelDown')
    expect(mouseCodeForWheel(mouse2Side, 0)).toBeNull()
  })
})
