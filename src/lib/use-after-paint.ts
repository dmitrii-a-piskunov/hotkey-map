import { startTransition, useEffect, useState } from 'react'

/**
 * Значение, которое догоняет исходное после отрисовки кадра. Так панель
 * обновляется после клавиатуры (FR-13, NFR-02): кадр с подсвеченными
 * клавишами рисуется сразу, а панель — следом, в прерываемом рендере.
 * useDeferredValue этого не гарантирует: его рендер может закончиться до
 * отрисовки, и тогда кадр ждёт панель.
 */
export function useAfterPaint<T>(value: T): T {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (Object.is(shown, value)) return
    let timer: number | undefined
    // requestAnimationFrame — перед отрисовкой кадра, задача после него — уже после
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        startTransition(() => {
          setShown(value)
        })
      }, 0)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [value, shown])
  return shown
}
