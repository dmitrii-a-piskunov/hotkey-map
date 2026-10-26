import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Workspace } from '@/app/workspace'
import { createAppData } from '@/domain/app-data'
import { useDataStore } from '@/features/data/store'
import { initialDevicesData, useDevicesStore } from '@/features/devices/store'
import { PersistenceContext } from '@/features/persistence/persistence-context'
import { PersistenceSession } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { makeTestEnv } from './mocks/persistence-env'

/** Главный экран без запуска хранения: меню шапки берёт сессию из контекста */
function renderWorkspace(extra?: ReactNode) {
  const session = new PersistenceSession(makeTestEnv().env)
  return render(
    <PersistenceContext value={session}>
      <Workspace />
      {extra}
    </PersistenceContext>,
  )
}

function input(code: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-input-code="${code}"]`)
  if (!el) throw new Error(`No input ${code}`)
  return el
}

function selectedCodes(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-input-code][data-selected]'),
    (el) => el.dataset.inputCode ?? '',
  ).sort()
}

function keyDown(code: string, init: KeyboardEventInit = {}): boolean {
  return fireEvent.keyDown(window, { code, key: init.key ?? code, ...init })
}

function keyUp(code: string, init: KeyboardEventInit = {}): boolean {
  return fireEvent.keyUp(window, { code, key: init.key ?? code, ...init })
}

const settings = () => useDataStore.getState().data.appSettings

beforeEach(() => {
  useDevicesStore.setState(initialDevicesData)
  useDataStore.getState().replaceData(createAppData())
})

describe('devices rendering', () => {
  it('renders 80 keys and 7 mouse inputs', () => {
    renderWorkspace()
    expect(document.querySelectorAll('[data-kind="key"]')).toHaveLength(80)
    expect(document.querySelectorAll('[data-kind="mouse"]')).toHaveLength(7)
  })

  it('shows both EN and RU labels on letter keys', () => {
    renderWorkspace()
    expect(input('KeyQ')).toHaveTextContent('Q')
    expect(input('KeyQ')).toHaveTextContent('Й')
  })
})

describe('mouse selection (FR-13)', () => {
  it('TC-06: click Q, Shift+click D, Ctrl+click F', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('KeyD'), { shiftKey: true })
    fireEvent.click(input('KeyF'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['KeyA', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyS', 'KeyW'])
  })

  it('Ctrl+click on a selected key removes only that key', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('KeyW'), { ctrlKey: true })
    fireEvent.click(input('KeyQ'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['KeyW'])
  })

  it('selects mouse inputs by click', () => {
    renderWorkspace()
    fireEvent.click(input('MouseLeft'))
    fireEvent.click(input('WheelUp'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['MouseLeft', 'WheelUp'])
  })

  it('Fn is not selectable', () => {
    renderWorkspace()
    fireEvent.click(input('Fn'))
    expect(selectedCodes()).toEqual([])
  })

  it('click on empty space clears selection', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 5, clientY: 5 })
    fireEvent.pointerUp(stage, { button: 0, pointerId: 1, clientX: 5, clientY: 5 })
    expect(selectedCodes()).toEqual([])
  })

  it('marquee selects keys under the frame', () => {
    renderWorkspace()
    // jsdom has no layout: give two keys a screen box
    const boxes: Record<string, DOMRect> = {
      KeyQ: new DOMRect(100, 100, 40, 40),
      KeyW: new DOMRect(150, 100, 40, 40),
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-input-code]')) {
      const box = boxes[el.dataset.inputCode ?? ''] ?? new DOMRect(-100, -100, 1, 1)
      el.getBoundingClientRect = () => box
      const face = el.querySelector<HTMLElement>('.cap3d-top, .key-top')
      if (face) face.getBoundingClientRect = () => box
    }
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 90, clientY: 90 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 160, clientY: 120 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 160, clientY: 120 })
    expect(selectedCodes()).toEqual(['KeyQ', 'KeyW'])
  })
})

describe('pointer on keys (FR-01, FR-13)', () => {
  function fakeBoxes(boxes: Record<string, DOMRect>) {
    for (const el of document.querySelectorAll<HTMLElement>('[data-input-code]')) {
      const box = boxes[el.dataset.inputCode ?? ''] ?? new DOMRect(-100, -100, 1, 1)
      el.getBoundingClientRect = () => box
      const face = el.querySelector<HTMLElement>('.cap3d-top, .key-top')
      if (face) face.getBoundingClientRect = () => box
    }
  }

  it('click shows the key pressed while the button is held', () => {
    renderWorkspace()
    fireEvent.pointerDown(input('KeyQ'), { button: 0, pointerId: 1, clientX: 10, clientY: 10 })
    expect(input('KeyQ')).toHaveAttribute('data-pressed')
    fireEvent.pointerUp(input('KeyQ'), { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.click(input('KeyQ'))
    expect(input('KeyQ')).not.toHaveAttribute('data-pressed')
    expect(selectedCodes()).toEqual(['KeyQ'])
  })

  it('TC-20: marquee can start on a key and does not press it', () => {
    renderWorkspace()
    fakeBoxes({ KeyQ: new DOMRect(100, 100, 40, 40), KeyW: new DOMRect(150, 100, 40, 40) })
    fireEvent.pointerDown(input('KeyQ'), { button: 0, pointerId: 1, clientX: 110, clientY: 110 })
    fireEvent.pointerMove(input('KeyQ'), { pointerId: 1, clientX: 170, clientY: 120 })
    expect(input('KeyQ')).not.toHaveAttribute('data-pressed')
    fireEvent.pointerUp(input('KeyQ'), { pointerId: 1, clientX: 170, clientY: 120 })
    expect(selectedCodes()).toEqual(['KeyQ', 'KeyW'])
  })
})

describe('check mode (FR-03)', () => {
  beforeEach(() => {
    useDataStore.getState().updateSettings({ inputMode: 'check' })
  })

  it('TC-07: real key press animates and selects the key', () => {
    renderWorkspace()
    keyDown('KeyF', { key: 'f' })
    expect(input('KeyF')).toHaveAttribute('data-pressed')
    expect(selectedCodes()).toEqual(['KeyF'])
    keyUp('KeyF', { key: 'f' })
    expect(input('KeyF')).not.toHaveAttribute('data-pressed')
  })

  it('combination with a modifier selects the main key', () => {
    renderWorkspace()
    keyDown('ControlLeft', { key: 'Control', ctrlKey: true })
    keyDown('KeyQ', { key: 'q', ctrlKey: true })
    keyUp('KeyQ', { key: 'q', ctrlKey: true })
    keyUp('ControlLeft', { key: 'Control' })
    expect(selectedCodes()).toEqual(['KeyQ'])
  })

  it('modifier pressed and released alone selects itself', () => {
    renderWorkspace()
    keyDown('ShiftLeft', { key: 'Shift', shiftKey: true })
    expect(selectedCodes()).toEqual([])
    keyUp('ShiftLeft', { key: 'Shift' })
    expect(selectedCodes()).toEqual(['ShiftLeft'])
  })

  it('Shift+click does not select Shift on release', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    keyDown('ShiftLeft', { key: 'Shift', shiftKey: true })
    fireEvent.mouseDown(input('KeyD'))
    fireEvent.click(input('KeyD'), { shiftKey: true })
    keyUp('ShiftLeft', { key: 'Shift' })
    expect(selectedCodes()).toEqual(['KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyS', 'KeyW'])
  })

  it('Esc clears selection', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    keyDown('Escape', { key: 'Escape' })
    expect(selectedCodes()).toEqual([])
  })

  it('prevents default except for browser combinations', () => {
    renderWorkspace()
    expect(keyDown('F5', { key: 'F5' })).toBe(false)
    expect(keyDown('KeyW', { key: 'w', ctrlKey: true })).toBe(true)
  })

  it('TC-18: wheel click selects MouseMiddle', () => {
    renderWorkspace()
    fireEvent.mouseDown(window, { button: 1 })
    expect(selectedCodes()).toEqual(['MouseMiddle'])
    expect(input('MouseMiddle')).toHaveAttribute('data-pressed')
    fireEvent.mouseUp(window, { button: 1 })
    expect(input('MouseMiddle')).not.toHaveAttribute('data-pressed')
  })

  it('TC-18: wheel over the keyboard selects the scroll input', () => {
    renderWorkspace()
    fireEvent.wheel(input('KeyQ'), { deltaY: 50 })
    expect(selectedCodes()).toEqual(['WheelDown'])
  })

  it('side mouse buttons select Mouse4 and Mouse5', () => {
    renderWorkspace()
    fireEvent.mouseDown(window, { button: 3 })
    expect(selectedCodes()).toEqual(['Mouse4'])
    fireEvent.mouseUp(window, { button: 3 })
    fireEvent.mouseDown(window, { button: 4 })
    expect(selectedCodes()).toEqual(['Mouse5'])
  })

  it('wheel over the mouse selects the scroll input', () => {
    renderWorkspace()
    fireEvent.wheel(screen.getByRole('group', { name: ru.devices.mouse }), { deltaY: -50 })
    expect(selectedCodes()).toEqual(['WheelUp'])
  })

  it('ignores keys typed into text fields', () => {
    renderWorkspace(<input aria-label="field" />)
    const field = screen.getByLabelText('field')
    fireEvent.keyDown(field, { code: 'KeyF', key: 'f' })
    expect(selectedCodes()).toEqual([])
  })
})

describe('navigation mode (FR-03)', () => {
  beforeEach(() => {
    useDataStore.getState().updateSettings({ inputMode: 'nav' })
  })

  it('TC-14: select Q, Shift+→ twice selects Q W E, screen arrows are not selected', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    keyDown('ArrowRight', { key: 'ArrowRight', shiftKey: true })
    keyDown('ArrowRight', { key: 'ArrowRight', shiftKey: true })
    expect(selectedCodes()).toEqual(['KeyE', 'KeyQ', 'KeyW'])
    expect(input('ArrowRight')).not.toHaveAttribute('data-pressed')
  })

  it('arrows move selection, keys do not select themselves', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    keyDown('ArrowDown', { key: 'ArrowDown' })
    keyDown('KeyF', { key: 'f' })
    expect(selectedCodes()).toEqual(['KeyA'])
    expect(input('KeyF')).not.toHaveAttribute('data-pressed')
  })
})

describe('label language (FR-04)', () => {
  it('TC-19: in EN and RU switches by the typed character', () => {
    useDataStore.getState().updateSettings({ labelLang: 'en' })
    renderWorkspace()
    keyDown('KeyQ', { key: 'й' })
    expect(settings().labelLang).toBe('ru')
    keyDown('KeyQ', { key: 'q' })
    expect(settings().labelLang).toBe('en')
  })

  it('TC-19: EN/RU never switches by itself', () => {
    renderWorkspace()
    keyDown('KeyQ', { key: 'й' })
    expect(settings().labelLang).toBe('enru')
  })

  it('does not switch when auto is off', () => {
    useDataStore.getState().updateSettings({ labelLang: 'en', autoLang: false })
    renderWorkspace()
    keyDown('KeyQ', { key: 'й' })
    expect(settings().labelLang).toBe('en')
  })

  it('EN and RU show one centered legend for letters, digits and symbols', () => {
    useDataStore.getState().updateSettings({ labelLang: 'ru' })
    const { unmount } = renderWorkspace()
    expect(input('KeyQ').textContent).toBe('Й')
    expect(input('Digit3').textContent).toBe('3')
    expect(input('Slash').textContent).toBe('.')
    expect(input('Tab')).toHaveTextContent('Tab')
    expect(input('Space').textContent).toBe('Пробел')
    unmount()
    useDataStore.getState().updateSettings({ labelLang: 'en' })
    renderWorkspace()
    expect(input('KeyQ').textContent).toBe('Q')
    expect(input('Digit3').textContent).toBe('3')
    expect(input('Slash').textContent).toBe('/')
    expect(input('Space').textContent).toBe('Space')
  })
})

describe('view bar switches', () => {
  it('navigation is the default; switches input mode, label language and view', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    expect(settings().inputMode).toBe('nav')
    await user.click(screen.getByRole('radio', { name: ru.header.modeCheck }))
    expect(settings().inputMode).toBe('check')
    await user.click(screen.getByRole('radio', { name: 'RU' }))
    expect(settings().labelLang).toBe('ru')
    await user.click(screen.getByRole('radio', { name: '2D' }))
    expect(screen.getByTestId('device-stage')).toHaveAttribute('data-view', '2d')
  })
})

describe('not assignable keys', () => {
  it('TC-17: Fn shows the red frame and the hint below while the mouse button is held', () => {
    renderWorkspace()
    fireEvent.pointerDown(input('Fn'), { button: 0 })
    expect(input('Fn')).toHaveAttribute('data-rejected')
    const hint = screen.getByRole('status')
    expect(hint).toHaveTextContent(ru.devices.notPassedToGames)
    expect(hint).toHaveAttribute('data-place', 'below')
    fireEvent.pointerUp(window)
    expect(input('Fn')).not.toHaveAttribute('data-rejected')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('the knob reacts too and stays unselected, its hint is above; Win is a usual key', () => {
    renderWorkspace()
    fireEvent.pointerDown(input('Knob'), { button: 0 })
    expect(input('Knob')).toHaveAttribute('data-rejected')
    expect(screen.getByRole('status')).toHaveAttribute('data-place', 'above')
    fireEvent.pointerUp(window)
    fireEvent.click(input('Knob'))
    expect(selectedCodes()).toEqual([])

    // FR-05: Win блокирует только игра, в которой её нет в настройках
    fireEvent.pointerDown(input('MetaLeft'), { button: 0 })
    expect(input('MetaLeft')).not.toHaveAttribute('data-rejected')
    fireEvent.pointerUp(window)
    fireEvent.click(input('MetaLeft'))
    expect(selectedCodes()).toEqual(['MetaLeft'])
  })

  it('Ctrl+click selects Fn in red; a click keeps it, holding shows the hint only', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('Fn'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['Fn', 'KeyQ'])
    expect(input('Fn')).toHaveAttribute('data-rejected')
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.pointerDown(input('Fn'), { button: 0 })
    expect(screen.getByRole('status')).toHaveTextContent(ru.devices.notPassedToGames)
    fireEvent.pointerUp(window)
    fireEvent.click(input('Fn'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(selectedCodes()).toEqual(['Fn', 'KeyQ'])
    expect(input('Fn')).toHaveAttribute('data-rejected')
    expect(input('Fn')).not.toHaveAttribute('data-pressed')

    fireEvent.click(input('Fn'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['KeyQ'])
    expect(input('Fn')).not.toHaveAttribute('data-rejected')
  })

  it('Shift+arrows stop on Fn and keep it red without the hint', () => {
    useDataStore.getState().updateSettings({ inputMode: 'nav' })
    renderWorkspace()
    fireEvent.click(input('Space'))
    keyDown('ArrowRight', { key: 'ArrowRight', shiftKey: true })
    expect(selectedCodes()).toEqual(['Fn', 'Space'])
    expect(input('Fn')).toHaveAttribute('data-rejected')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('mouse in ranges and marquee (FR-13)', () => {
  it('marquee ignores a key whose top face it does not touch', () => {
    renderWorkspace()
    for (const el of document.querySelectorAll<HTMLElement>('[data-input-code]')) {
      const far = new DOMRect(-100, -100, 1, 1)
      el.getBoundingClientRect = () =>
        el.dataset.inputCode === 'KeyQ' ? new DOMRect(100, 100, 40, 60) : far
      const face = el.querySelector<HTMLElement>('.cap3d-top, .key-top')
      // Верх Q — в верхней половине блока; рамка задевает только низ блока
      if (face)
        face.getBoundingClientRect = () =>
          el.dataset.inputCode === 'KeyQ' ? new DOMRect(105, 100, 30, 30) : far
    }
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 90, clientY: 145 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 150, clientY: 170 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 150, clientY: 170 })
    expect(selectedCodes()).toEqual([])
  })

  it('Shift+click from a key to a mouse button selects both and keys between', () => {
    renderWorkspace()
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('MouseLeft'), { shiftKey: true })
    expect(selectedCodes()).toEqual(expect.arrayContaining(['KeyQ', 'PageUp', 'MouseLeft']))
  })

  it('marquee selects mouse buttons', () => {
    renderWorkspace()
    const boxes: Record<string, DOMRect> = {
      PageUp: new DOMRect(100, 100, 40, 40),
      Mouse5: new DOMRect(160, 100, 10, 30),
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-input-code]')) {
      const box = boxes[el.dataset.inputCode ?? ''] ?? new DOMRect(-100, -100, 1, 1)
      el.getBoundingClientRect = () => box
      const face = el.querySelector<HTMLElement>('.cap3d-top, .key-top')
      if (face) face.getBoundingClientRect = () => box
    }
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 90, clientY: 90 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 180, clientY: 120 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 180, clientY: 120 })
    expect(selectedCodes()).toEqual(['Mouse5', 'PageUp'])
  })
})
