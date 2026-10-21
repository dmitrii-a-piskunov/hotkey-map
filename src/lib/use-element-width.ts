import { useEffect, useState, type RefObject } from 'react'

/** Ширина элемента в пикселях, обновляется при изменении размера */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [ref])

  return width
}
