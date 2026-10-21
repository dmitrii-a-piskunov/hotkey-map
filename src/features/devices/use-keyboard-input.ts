/**
 * Реакция на настоящую клавиатуру и боковые кнопки мыши (ТЗ, FR-03, FR-04).
 * Работает, пока окно активно и фокус не в поле ввода.
 */

import { useEffect } from 'react'
import {
  arrowDirection,
  detectLabelLang,
  isModifierCode,
  isReservedCombo,
  mouseCodeForButton,
} from '@/domain/input'
import { isKeyboardCode, mouseLayout } from './devices'
import { useDevicesStore } from './store'

/** Боковые кнопки: браузер по ним уходит «Назад» и «Вперёд» */
const SIDE_BUTTONS = new Set([3, 4])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useKeyboardInput(): void {
  useEffect(() => {
    // Модификатор, нажатый без других клавиш: при отпускании выделяет сам себя
    let lonelyModifier: string | null = null

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      const store = useDevicesStore.getState()

      const lang = detectLabelLang(e.key)
      if (lang && lang !== store.labelLang) store.setLabelLang(lang)

      if (isReservedCombo(e)) return
      e.preventDefault()

      if (e.code === 'Escape') {
        lonelyModifier = null
        if (store.inputMode === 'check') store.press(e.code)
        store.clearSelection()
        return
      }

      if (store.inputMode === 'nav') {
        const dir = arrowDirection(e.code)
        if (dir) store.navigate(dir, e.shiftKey)
        else if (e.code === 'KeyA' && e.ctrlKey) store.selectAllOccupied()
        return
      }

      if (!isKeyboardCode(e.code)) return
      store.press(e.code)
      if (isModifierCode(e.code)) {
        if (!e.repeat) lonelyModifier = e.code
        return
      }
      lonelyModifier = null
      // Слои по модификаторам (FR-14) появятся на этапе 4, пока выделяем саму клавишу
      if (!e.repeat) store.selectOnly(e.code)
    }

    function onKeyUp(e: KeyboardEvent) {
      const store = useDevicesStore.getState()
      store.release(e.code)
      if (lonelyModifier === e.code) {
        lonelyModifier = null
        if (store.inputMode === 'check' && !isEditableTarget(e.target)) store.selectOnly(e.code)
      }
    }

    function onMouseDown(e: MouseEvent) {
      // Ctrl+клик и Shift+клик: модификатор после клика не выделяет сам себя
      lonelyModifier = null
      if (!SIDE_BUTTONS.has(e.button)) return
      e.preventDefault()
      const store = useDevicesStore.getState()
      if (store.inputMode !== 'check') return
      const code = mouseCodeForButton(mouseLayout, e.button)
      if (code) {
        store.press(code)
        store.selectOnly(code)
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (!SIDE_BUTTONS.has(e.button)) return
      e.preventDefault()
      const code = mouseCodeForButton(mouseLayout, e.button)
      if (code) useDevicesStore.getState().release(code)
    }

    function onBlur() {
      lonelyModifier = null
      useDevicesStore.getState().releaseAll()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
