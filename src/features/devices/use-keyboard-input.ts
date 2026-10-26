/**
 * Реакция на настоящую клавиатуру и боковые кнопки мыши (ТЗ, FR-03, FR-04,
 * FR-12, FR-14). Работает, пока окно активно и фокус не в поле ввода.
 */

import { useEffect } from 'react'
import { layerKey } from '@/domain/bindings'
import {
  arrowDirection,
  detectLabelLang,
  heldModifiers,
  isModifierCode,
  isReservedCombo,
  mouseCodeForButton,
} from '@/domain/input'
import { BASE_LAYER } from '@/domain/layers'
import { captureInputCmd } from '@/features/bindings/commands'
import { cancelCapture, isCapturing, setHighlight, setLayer } from '@/features/bindings/ui-store'
import { useDataStore } from '@/features/data/store'
import { redoCmd, undoCmd } from '@/features/history/history'
import { isKeyboardCode, mouseLayout } from './devices'
import { useDevicesStore } from './store'

/**
 * Кнопки мыши, которые выделяются в режиме проверки: нажатие колеса и
 * боковые. preventDefault убирает автопрокрутку по колесу и уход «Назад»
 * и «Вперёд» по боковым. ЛКМ и ПКМ заняты выделением и меню.
 */
const TRACKED_BUTTONS = new Set([1, 3, 4])

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isTextField(target)) return true
  // Диалоги и меню (редактор игры, профили) работают с клавиатуры сами (8.5)
  return target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null
}

/** Захват отменяет клик вне сцены и вне кнопки захвата (FR-12) */
function isCaptureZone(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-testid="device-stage"], [data-capture-slot], [data-bind-dialog]') !== null
  )
}

export function useKeyboardInput(): void {
  useEffect(() => {
    // Модификатор, нажатый без других клавиш: при отпускании выделяет сам себя
    let lonelyModifier: string | null = null
    // Клавиша, пойманная захватом: её отпускание не должно нажать кнопку в фокусе
    let swallowed: string | null = null

    /** Режим захвата «Нажмите клавишу…» (FR-12) */
    function onCaptureKeyDown(e: KeyboardEvent) {
      if (isReservedCombo(e)) return
      e.preventDefault()
      if (e.repeat) return
      if (e.code === 'Escape') {
        lonelyModifier = null
        swallowed = e.code
        cancelCapture()
        return
      }
      if (isModifierCode(e.code)) {
        lonelyModifier = e.code
        return
      }
      lonelyModifier = null
      if (!isKeyboardCode(e.code)) return
      swallowed = e.code
      captureInputCmd(e.code, heldModifiers(e))
    }

    function onKeyDown(e: KeyboardEvent) {
      // Окно привязки ловит клавиши и тогда, когда фокус на его кнопках
      if (isCapturing() && !isTextField(e.target)) {
        onCaptureKeyDown(e)
        return
      }
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
        setHighlight(null)
        return
      }

      if (settings.inputMode === 'nav') {
        const dir = arrowDirection(e.code)
        if (dir) store.navigate(dir, e.shiftKey)
        else if (e.code === 'KeyA' && e.ctrlKey) store.selectAllOccupied()
        // FR-24: отмена и повтор только в навигации — в проверке Ctrl+Z выделяет клавиши
        else if (e.code === 'KeyZ' && e.ctrlKey && !e.repeat) {
          if (e.shiftKey) redoCmd()
          else undoCmd()
        }
        return
      }

      if (!isKeyboardCode(e.code)) return
      store.press(e.code)
      if (isModifierCode(e.code)) {
        if (!e.repeat) lonelyModifier = e.code
        return
      }
      lonelyModifier = null
      if (e.repeat) return
      // FR-14: комбинация переключает слой, клавиша без модификаторов — основной слой
      setLayer(layerKey(heldModifiers(e)))
      store.selectOnly(e.code)
    }

    function onKeyUp(e: KeyboardEvent) {
      const store = useDevicesStore.getState()
      store.release(e.code)
      if (swallowed === e.code) {
        swallowed = null
        e.preventDefault()
      }
      if (lonelyModifier !== e.code) return
      lonelyModifier = null
      if (isCapturing() ? isTextField(e.target) : isEditableTarget(e.target)) return
      // Alt в Firefox при отпускании открывает меню окна
      e.preventDefault()
      if (isCapturing()) {
        captureInputCmd(e.code, heldModifiers(e))
        return
      }
      if (useDataStore.getState().data.appSettings.inputMode !== 'check') return
      // Сама клавиша-модификатор живёт в основном слое: Shift — «Бег»
      setLayer(BASE_LAYER)
      store.selectOnly(e.code)
    }

    function onPointerDownCapture(e: PointerEvent) {
      if (isCapturing() && !isCaptureZone(e.target)) cancelCapture()
    }

    function onMouseDown(e: MouseEvent) {
      // Ctrl+клик и Shift+клик: модификатор после клика не выделяет сам себя
      lonelyModifier = null
      if (!TRACKED_BUTTONS.has(e.button)) return
      e.preventDefault()
      // В захвате кнопки мыши ловит сцена — над изображением мыши
      if (isCapturing()) return
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
    window.addEventListener('pointerdown', onPointerDownCapture, true)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDownCapture, true)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
