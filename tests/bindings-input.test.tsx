import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/app/app'
import { serializeAppData } from '@/domain/app-data'
import { setLayer, startCapture, useBindingsUi, type SlotRef } from '@/features/bindings/ui-store'
import { useDataStore } from '@/features/data/store'
import { initialDevicesData, useDevicesStore } from '@/features/devices/store'
import { PersistenceSession } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { at, sampleData } from './fixtures'
import { makeTestEnv, resetStores } from './mocks/persistence-env'

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

let session: PersistenceSession | null = null

beforeEach(() => {
  resetStores()
  useDevicesStore.setState(initialDevicesData)
  useBindingsUi.setState({ layer: '', capture: null, feedback: null, highlight: null })
})

afterEach(() => {
  session?.dispose()
  session = null
})

/** Главный экран с игрой PUBG из фикстуры */
async function renderApp() {
  const env = makeTestEnv({ savedFolder: true })
  env.folder.writeText('data.json', serializeAppData(sampleData()))
  session = new PersistenceSession(env.env)
  await session.start()
  render(<App session={session} />)
}

describe('layers from the real keyboard (FR-14)', () => {
  it('a combination switches the layer, a plain key returns to the base one', async () => {
    await renderApp()
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
    await renderApp()
    setLayer('ctrl')
    keyDown('ShiftLeft', { shiftKey: true })
    keyUp('ShiftLeft')
    expect(ui().layer).toBe('')
    expect(selectedCodes()).toEqual(['ShiftLeft'])
  })

  it('Ctrl+A in navigation selects occupied keys of the current layer', async () => {
    await renderApp()
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
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'ShiftLeft', modifiers: [] }])
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
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'KeyW', modifiers: ['ctrl'] }])
    expect(selectedCodes()).toEqual([])
  })

  it('held modifiers win over the layer; Esc is assigned by click', async () => {
    await renderApp()
    setLayer('ctrl')
    startCapture(SLOT)
    fireEvent.pointerDown(input('Escape'), { button: 0, pointerId: 1, altKey: true })
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Escape', modifiers: ['alt'] }])
  })

  it('Fn and blocked keys are refused with a message', async () => {
    await renderApp()
    startCapture(SLOT)
    fireEvent.pointerDown(input('MetaLeft'), { button: 0, pointerId: 1 })
    expect(ui().feedback).toEqual({ ...SLOT, kind: 'error', error: { kind: 'blockedKey' } })
    expect(jumpInputs()).toEqual([{ device: 'keyboard', code: 'Space', modifiers: [] }])
  })

  it('mouse buttons and wheel over the mouse picture are captured', async () => {
    await renderApp()
    const mouse = screen.getByRole('group', { name: ru.devices.mouse })
    startCapture(SLOT)
    fireEvent.pointerDown(mouse, { button: 1, pointerId: 1 })
    expect(jumpInputs()).toEqual([{ device: 'mouse', code: 'MouseMiddle', modifiers: [] }])
    startCapture(SLOT)
    fireEvent.wheel(mouse, { deltaY: -40 })
    expect(jumpInputs()).toEqual([{ device: 'mouse', code: 'WheelUp', modifiers: [] }])
    startCapture(SLOT)
    fireEvent.pointerDown(input('Mouse4'), { button: 0, pointerId: 1 })
    expect(jumpInputs()).toEqual([{ device: 'mouse', code: 'Mouse4', modifiers: [] }])
  })

  it('a click outside the stage cancels capture', async () => {
    await renderApp()
    startCapture(SLOT)
    fireEvent.pointerDown(document.body, { button: 0, pointerId: 1 })
    expect(ui().capture).toBeNull()
  })
})
