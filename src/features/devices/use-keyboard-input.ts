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
import { useDataStore } from '@/features/data/store'
import { isKeyboardCode, mouseLayout } from './devices'
import { useDevicesStore } from './store'

/**
 * Кнопки мыши, которые выделяются в режиме проверки: нажатие колеса и
 * боковые. preventDefault убирает автопрокрутку по колесу и уход «Назад»
 * и «Вперёд» по боковым. ЛКМ и ПКМ заняты выделением и меню.
 */
const TRACKED_BUTTONS = new Set([1, 3, 4])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  // Диалоги и меню (редактор игры, профили) работают с клавиатуры сами (8.5)
  return target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null
}

export function useKeyboardInput(): void {
  useEffect(() => {
    // Модификатор, нажатый без других клавиш: при отпускании выделяет сам себя
    let lonelyModifier: string | null = null

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      const store = useDevicesStore.getState()
      const settings = useDataStore.getState().data.appSettings

      // FR-04: в режимах EN и RU раскладка подписей следует за последней клавишей;
      // EN/RU выбирается только вручную и сам не меняется
      const lang = detectLabelLang(e.key)
      if (lang && settings.autoLang && settings.labelLang !== 'enru' && lang !== settings.labelLang)
        useDataStore.getState().updateSettings({ labelLang: lang })

      if (isReservedCombo(e)) return
      e.preventDefault()

      if (e.code === 'Escape') {
        lonelyModifier = null
        if (settings.inputMode === 'check') store.press(e.code)
        store.clearSelection()
        return
      }

      if (settings.inputMode === 'nav') {
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
        const { inputMode } = useDataStore.getState().data.appSettings
        if (inputMode === 'check' && !isEditableTarget(e.target)) store.selectOnly(e.code)
      }
    }

    function onMouseDown(e: MouseEvent) {
      // Ctrl+клик и Shift+клик: модификатор после клика не выделяет сам себя
      lonelyModifier = null
      if (!TRACKED_BUTTONS.has(e.button)) return
      e.preventDefault()
      if (useDataStore.getState().data.appSettings.inputMode !== 'check') return
      const store = useDevicesStore.getState()
      const code = mouseCodeForButton(mouseLayout, e.button)
      if (code) {
        store.press(code)
        store.selectOnly(code)
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (!TRACKED_BUTTONS.has(e.button)) return
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
