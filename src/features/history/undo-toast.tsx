import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { KEEP_DIALOG_ATTR } from '@/components/ui/dialog'
import { ru } from '@/i18n/ru'
import { hideUndoToast, UNDO_TOAST_MS, undoCmd, useUndoToast } from './history'

/** После удаления: «… удалено» и кнопка «Отменить» внизу экрана (FR-24) */
export function UndoToast() {
  const message = useUndoToast((s) => s.message)
  const key = useUndoToast((s) => s.key)

  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(hideUndoToast, UNDO_TOAST_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [message, key])

  if (message === null) return null
  return (
    // Поверх модального окна: pointer-events возвращаем, клик не закрывает окно
    <div
      role="status"
      data-testid="undo-toast"
      {...{ [KEEP_DIALOG_ATTR]: '' }}
      style={{ pointerEvents: 'auto' }}
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-md border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
    >
      <span>{message}</span>
      <Button size="sm" variant="outline" onClick={undoCmd}>
        {ru.history.undo}
      </Button>
    </div>
  )
}
