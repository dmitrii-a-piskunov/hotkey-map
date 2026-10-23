import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no pointer capture; the device stage uses it for the marquee
const captured = new WeakMap<Element, Set<number>>()
Element.prototype.setPointerCapture = function (id: number) {
  const set = captured.get(this) ?? new Set<number>()
  set.add(id)
  captured.set(this, set)
}
Element.prototype.releasePointerCapture = function (id: number) {
  captured.get(this)?.delete(id)
}
Element.prototype.hasPointerCapture = function (id: number) {
  return captured.get(this)?.has(id) ?? false
}

// jsdom has no ResizeObserver; Radix Slider measures its thumb with it
class NoResizeObserver {
  observe(): void {
    // Размеры в jsdom не меняются — сообщать не о чем
  }
  unobserve(): void {
    // Нечего снимать
  }
  disconnect(): void {
    // Нечего отключать
  }
}
if (!('ResizeObserver' in globalThis)) globalThis.ResizeObserver = NoResizeObserver

afterEach(() => {
  cleanup()
})
