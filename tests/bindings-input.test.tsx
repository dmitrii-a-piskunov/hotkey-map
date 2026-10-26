import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLayer, startCapture, useBindingsUi, type SlotRef } from '@/features/bindings/ui-store'
import { confirmCaptureCmd } from '@/features/bindings/commands'
import { useDataStore } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { deviceTheme } from '@/styles/device-theme'
import { at, sampleData } from './fixtures'
import { disposeApp, renderApp as renderWithData, resetAppStores } from './mocks/render-app'

const JUMP = '44444444-4444-4444-8444-444444444441'
const SLOT: SlotRef = { actionId: JUMP, slot: 1 }

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

function keyDown(code: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyDown(window, { code, key: code, ...init })
}

function keyUp(code: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyUp(window, { code, key: code, ...init })
}

/** Бинды прыжка в текущем профиле */
function jumpInputs() {
  const profile = at(at(useDataStore.getState().data.games, 0).profiles, 0)
  return profile.bindings.filter((b) => b.actionId === JUMP).map((b) => b.input)
}

const ui = () => useBindingsUi.getState()
const pending = () => ui().capture?.pending

beforeEach(resetAppStores)
afterEach(disposeApp)

/** Главный экран с примером данных; по умолчанию режим «Навигация» (FR-03) */
const renderApp = (inputMode: 'check' | 'nav' = 'nav') => {
  const data = sampleData()
  return renderWithData({ ...data, appSettings: { ...data.appSettings, inputMode } })
}

describe('layers from the real keyboard (FR-14)', () => {
  it('a combination switches the layer, a plain key returns to the base one', async () => {
    await renderApp('check')
    keyDown('ControlLeft', { ctrlKey: true })
    keyDown('Digit1', { ctrlKey: true })
    expect(ui().layer).toBe('ctrl')
    expect(selectedCodes()).toEqual(['Digit1'])
    keyUp('Digit1', { ctrlKey: true })
    keyUp('ControlLeft')
    keyDown('KeyQ')
    expect(ui().layer).toBe('')
  })

  it('a lonely modifier selects itself in the base layer', async () => {
    await renderApp('check')
    setLayer('ctrl')
    keyDown('ShiftLeft', { shiftKey: true })
    keyUp('ShiftLeft')
    expect(ui().layer).toBe('')
    expect(selectedCodes()).toEqual(['ShiftLeft'])
  })

  it('Ctrl+A in navigation selects occupied keys of the current layer', async () => {
    await renderApp('check')
    useDataStore.getState().updateSettings({ inputMode: 'nav' })
    keyDown('KeyA', { ctrlKey: true })
    expect(selectedCodes()).toEqual(['Space'])
    setLayer('ctrl')
    keyDown('KeyA', { ctrlKey: true })
    expect(selectedCodes()).toEqual([])
  })
})

describe('key capture (FR-12)', () => {
  it('a combination pressed in capture is saved as Ctrl+1', async () => {
    await renderApp()
    startCapture(SLOT)
    keyDown('ControlLeft', { ctrlKey: true })
    keyDown('Digit1', { ctrlKey: true })
    expect(pending()).toEqual({ device: 'keyboard', code: 'Digit1', modifiers: ['ctrl'] })
    // Сохраняет только «Подтвердить»
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Space', modifiers: [] }])
    confirmCaptureCmd()
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Digit1', modifiers: ['ctrl'] }])
    expect(ui().capture).toBeNull()
    // Клавиша в захвате не выделяется и слой не меняет
    expect(selectedCodes()).toEqual([])
    expect(ui().layer).toBe('')
  })

  it('a modifier pressed and released alone is captured itself', async () => {
    await renderApp()
    startCapture(SLOT)
    keyDown('ShiftLeft', { shiftKey: true })
    keyUp('ShiftLeft')
    expect(pending()).toEqual({ device: 'keyboard', code: 'ShiftLeft', modifiers: [] })
  })

  it('Esc cancels capture and keeps the binding', async () => {
    await renderApp()
    startCapture(SLOT)
    keyDown('Escape')
    expect(ui().capture).toBeNull()
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Space', modifiers: [] }])
  })

  it('a click on a screen key uses the current layer modifiers', async () => {
    await renderApp()
    setLayer('ctrl')
    startCapture(SLOT)
    fireEvent.pointerDown(input('KeyW'), { button: 0, pointerId: 1 })
    expect(pending()).toEqual({ device: 'keyboard', code: 'KeyW', modifiers: ['ctrl'] })
    expect(selectedCodes()).toEqual([])
  })

  it('held modifiers win over the layer; Esc is assigned by click', async () => {
    await renderApp()
    setLayer('ctrl')
    startCapture(SLOT)
    fireEvent.pointerDown(input('Escape'), { button: 0, pointerId: 1, altKey: true })
    expect(pending()).toEqual({ device: 'keyboard', code: 'Escape', modifiers: ['alt'] })
  })

  it('Fn and blocked keys cannot be confirmed', async () => {
    await renderApp()
    startCapture(SLOT)
    fireEvent.pointerDown(input('MetaLeft'), { button: 0, pointerId: 1 })
    confirmCaptureCmd()
    expect(ui().capture).not.toBeNull()
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Space', modifiers: [] }])
  })

  it('mouse buttons and wheel over the mouse picture are captured', async () => {
    await renderApp()
    const mouse = screen.getByRole('group', { name: ru.devices.mouse })
    startCapture(SLOT)
    fireEvent.pointerDown(mouse, { button: 1, pointerId: 1 })
    expect(pending()).toEqual({ device: 'mouse', code: 'MouseMiddle', modifiers: [] })
    startCapture(SLOT)
    fireEvent.wheel(mouse, { deltaY: -40 })
    expect(pending()).toEqual({ device: 'mouse', code: 'WheelUp', modifiers: [] })
    startCapture(SLOT)
    fireEvent.pointerDown(input('Mouse4'), { button: 0, pointerId: 1 })
    expect(pending()).toEqual({ device: 'mouse', code: 'Mouse4', modifiers: [] })
  })

  it('a click outside the stage cancels capture', async () => {
    await renderApp()
    startCapture(SLOT)
    fireEvent.pointerDown(document.body, { button: 0, pointerId: 1 })
    expect(ui().capture).toBeNull()
  })
})

describe('keys on the stage (FR-14, FR-15, FR-26, FR-30)', () => {
  it('the keyboard color switch changes native keys only (FR-01, TC-21)', async () => {
    await renderApp()
    const { standard, black } = deviceTheme.palettes
    const top = (code: string) => input(code).style.getPropertyValue('--cap-top')
    const legend = (code: string) => input(code).style.getPropertyValue('--legend')
    expect(top('KeyQ')).toBe(standard.caps.alpha.top)
    expect(top('Escape')).toBe(standard.caps.accent.top)

    fireEvent.click(screen.getByRole('radio', { name: ru.header.keyboardColorBlack }))
    expect(useDataStore.getState().data.appSettings.keyboardColor).toBe('black')
    for (const code of ['KeyQ', 'Escape', 'ShiftLeft', 'ArrowUp']) {
      expect(top(code)).toBe(black.caps.alpha.top)
      expect(legend(code)).toBe(black.caps.alpha.legend)
    }
    // Занятая клавиша — по-прежнему цвета категории
    expect(top('Space')).toBe('#3B82F6')

    fireEvent.click(screen.getByRole('radio', { name: '2D' }))
    expect(top('Escape')).toBe(black.caps.accent.top)
    expect(top('Space')).toBe('#3B82F6')

    fireEvent.click(screen.getByRole('radio', { name: ru.header.keyboardColorStandard }))
    expect(top('Escape')).toBe(standard.caps.accent.top)
  })

  it('a bound key is painted with its category and shows the action label', async () => {
    await renderApp()
    expect(input('Space').style.getPropertyValue('--cap-top')).toBe('#3B82F6')
    expect(input('Space')).toHaveTextContent('ПРЫ')
    expect(input('Space')).toHaveAttribute('title', 'Прыжок')
    expect(input('KeyQ').style.getPropertyValue('--cap-top')).not.toBe('#3B82F6')
  })

  it('labels can be switched off', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('button', { name: ru.bindings.showLabelsShort }))
    expect(useDataStore.getState().data.appSettings.showLabels).toBe(false)
    expect(input('Space')).not.toHaveTextContent('ПРЫ')
  })

  it('TC-05: in the Ctrl layer Ctrl+1 is lit and free keys are dimmed', async () => {
    await renderApp()
    startCapture(SLOT)
    keyDown('Digit1', { ctrlKey: true })
    confirmCaptureCmd()
    expect(input('Digit1')).not.toHaveTextContent('ПРЫ')
    expect(input('Digit1')).not.toHaveAttribute('data-dimmed')
    fireEvent.click(screen.getByRole('radio', { name: /^Ctrl/ }))
    expect(ui().layer).toBe('ctrl')
    expect(input('Digit1')).toHaveTextContent('ПРЫ')
    expect(input('Digit1')).not.toHaveAttribute('data-dimmed')
    expect(input('KeyQ')).toHaveAttribute('data-dimmed')
  })

  it('a conflict marks the key', async () => {
    await renderApp()
    const data = useDataStore.getState().data
    const game = at(data.games, 0)
    const twin = {
      ...at(game.actions, 0),
      id: '44444444-4444-4444-8444-444444444449',
      name: 'Двойник',
      order: 1,
    }
    const profile = at(game.profiles, 0)
    const bindings = [
      ...profile.bindings,
      { ...at(profile.bindings, 0), id: '77777777-7777-4777-8777-777777777779', actionId: twin.id },
    ]
    useDataStore.getState().replaceData({
      ...data,
      games: [{ ...game, actions: [...game.actions, twin], profiles: [{ ...profile, bindings }] }],
    })
    expect(await screen.findByText('+1')).toBeInTheDocument()
    expect(input('Space')).toHaveAttribute('data-conflict')
  })
})
