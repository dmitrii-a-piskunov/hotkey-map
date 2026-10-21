import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { initialDevicesData, useDevicesStore } from '@/features/devices/store'
import { ru } from '@/i18n/ru'

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

beforeEach(() => {
  useDevicesStore.setState(initialDevicesData)
})

describe('devices rendering', () => {
  it('renders 80 keys and 7 mouse inputs', () => {
    render(<App />)
    expect(document.querySelectorAll('[data-kind="key"]')).toHaveLength(80)
    expect(document.querySelectorAll('[data-kind="mouse"]')).toHaveLength(7)
  })

  it('shows both EN and RU labels on letter keys', () => {
    render(<App />)
    expect(input('KeyQ')).toHaveTextContent('Q')
    expect(input('KeyQ')).toHaveTextContent('Й')
  })
})

describe('mouse selection (FR-13)', () => {
  it('TC-06: click Q, Shift+click D, Ctrl+click F', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('KeyD'), { shiftKey: true })
    fireEvent.click(input('KeyF'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['KeyA', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyS', 'KeyW'])
  })

  it('Ctrl+click on a selected key removes only that key', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('KeyW'), { ctrlKey: true })
    fireEvent.click(input('KeyQ'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['KeyW'])
  })

  it('selects mouse inputs by click', () => {
    render(<App />)
    fireEvent.click(input('MouseLeft'))
    fireEvent.click(input('WheelUp'), { ctrlKey: true })
    expect(selectedCodes()).toEqual(['MouseLeft', 'WheelUp'])
  })

  it('Fn is not selectable', () => {
    render(<App />)
    fireEvent.click(input('Fn'))
    expect(selectedCodes()).toEqual([])
  })

  it('click on empty space clears selection', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 5, clientY: 5 })
    fireEvent.pointerUp(stage, { button: 0, pointerId: 1, clientX: 5, clientY: 5 })
    expect(selectedCodes()).toEqual([])
  })

  it('marquee selects keys under the frame', () => {
    render(<App />)
    // jsdom has no layout: give two keys a screen box
    const boxes: Record<string, DOMRect> = {
      KeyQ: new DOMRect(100, 100, 40, 40),
      KeyW: new DOMRect(150, 100, 40, 40),
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-input-code]')) {
      const box = boxes[el.dataset.inputCode ?? ''] ?? new DOMRect(-100, -100, 1, 1)
      el.getBoundingClientRect = () => box
    }
    const stage = screen.getByTestId('device-stage')
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 90, clientY: 90 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 160, clientY: 120 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 160, clientY: 120 })
    expect(selectedCodes()).toEqual(['KeyQ', 'KeyW'])
  })
})

describe('check mode (FR-03)', () => {
  it('TC-07: real key press animates and selects the key', () => {
    render(<App />)
    keyDown('KeyF', { key: 'f' })
    expect(input('KeyF')).toHaveAttribute('data-pressed')
    expect(selectedCodes()).toEqual(['KeyF'])
    keyUp('KeyF', { key: 'f' })
    expect(input('KeyF')).not.toHaveAttribute('data-pressed')
  })

  it('combination with a modifier selects the main key', () => {
    render(<App />)
    keyDown('ControlLeft', { key: 'Control', ctrlKey: true })
    keyDown('KeyQ', { key: 'q', ctrlKey: true })
    keyUp('KeyQ', { key: 'q', ctrlKey: true })
    keyUp('ControlLeft', { key: 'Control' })
    expect(selectedCodes()).toEqual(['KeyQ'])
  })

  it('modifier pressed and released alone selects itself', () => {
    render(<App />)
    keyDown('ShiftLeft', { key: 'Shift', shiftKey: true })
    expect(selectedCodes()).toEqual([])
    keyUp('ShiftLeft', { key: 'Shift' })
    expect(selectedCodes()).toEqual(['ShiftLeft'])
  })

  it('Shift+click does not select Shift on release', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    keyDown('ShiftLeft', { key: 'Shift', shiftKey: true })
    fireEvent.mouseDown(input('KeyD'))
    fireEvent.click(input('KeyD'), { shiftKey: true })
    keyUp('ShiftLeft', { key: 'Shift' })
    expect(selectedCodes()).toEqual(['KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyS', 'KeyW'])
  })

  it('Esc clears selection', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    keyDown('Escape', { key: 'Escape' })
    expect(selectedCodes()).toEqual([])
  })

  it('prevents default except for browser combinations', () => {
    render(<App />)
    expect(keyDown('F5', { key: 'F5' })).toBe(false)
    expect(keyDown('KeyW', { key: 'w', ctrlKey: true })).toBe(true)
  })

  it('side mouse buttons select Mouse4 and Mouse5', () => {
    render(<App />)
    fireEvent.mouseDown(window, { button: 3 })
    expect(selectedCodes()).toEqual(['Mouse4'])
    fireEvent.mouseUp(window, { button: 3 })
    fireEvent.mouseDown(window, { button: 4 })
    expect(selectedCodes()).toEqual(['Mouse5'])
  })

  it('wheel over the mouse selects the scroll input', () => {
    render(<App />)
    fireEvent.wheel(screen.getByRole('group', { name: ru.devices.mouse }), { deltaY: -50 })
    expect(selectedCodes()).toEqual(['WheelUp'])
  })

  it('ignores keys typed into text fields', () => {
    render(
      <>
        <App />
        <input aria-label="field" />
      </>,
    )
    const field = screen.getByLabelText('field')
    fireEvent.keyDown(field, { code: 'KeyF', key: 'f' })
    expect(selectedCodes()).toEqual([])
  })
})

describe('navigation mode (FR-03)', () => {
  beforeEach(() => {
    useDevicesStore.setState({ inputMode: 'nav' })
  })

  it('TC-14: select Q, Shift+→ twice selects Q W E, screen arrows are not selected', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    keyDown('ArrowRight', { key: 'ArrowRight', shiftKey: true })
    keyDown('ArrowRight', { key: 'ArrowRight', shiftKey: true })
    expect(selectedCodes()).toEqual(['KeyE', 'KeyQ', 'KeyW'])
    expect(input('ArrowRight')).not.toHaveAttribute('data-pressed')
  })

  it('arrows move selection, keys do not select themselves', () => {
    render(<App />)
    fireEvent.click(input('KeyQ'))
    keyDown('ArrowDown', { key: 'ArrowDown' })
    keyDown('KeyF', { key: 'f' })
    expect(selectedCodes()).toEqual(['KeyA'])
    expect(input('KeyF')).not.toHaveAttribute('data-pressed')
  })
})

describe('label language (FR-04)', () => {
  it('switches automatically by the typed character', () => {
    render(<App />)
    keyDown('KeyQ', { key: 'й' })
    expect(useDevicesStore.getState().labelLang).toBe('ru')
    keyDown('KeyQ', { key: 'q' })
    expect(useDevicesStore.getState().labelLang).toBe('en')
  })
})

describe('header switches', () => {
  it('switches input mode, label language and view', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: ru.header.modeNav }))
    expect(useDevicesStore.getState().inputMode).toBe('nav')
    await user.click(screen.getByRole('radio', { name: 'RU' }))
    expect(useDevicesStore.getState().labelLang).toBe('ru')
    await user.click(screen.getByRole('radio', { name: '2D' }))
    expect(screen.getByTestId('device-stage')).toHaveAttribute('data-view', '2d')
  })
})

describe('not assignable keys', () => {
  it('Fn flashes a red frame on click', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(input('Fn'))
    expect(input('Fn')).toHaveAttribute('data-rejected')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(input('Fn')).not.toHaveAttribute('data-rejected')
    vi.useRealTimers()
  })
})
