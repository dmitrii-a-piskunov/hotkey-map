import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ru } from '@/i18n/ru'
import { usePwaUpdate } from './pwa-update'

/**
 * FR-28: новая версия не включается сама — только по кнопке «Обновить».
 * Несохранённые изменения перед перезагрузкой дописывает защита закрытия
 * страницы (NFR-04).
 */
export function UpdateBanner() {
  const needRefresh = usePwaUpdate((s) => s.needRefresh)
  const update = usePwaUpdate((s) => s.update)

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="flex min-h-9 items-center gap-2 border-b bg-muted px-4 py-1 text-sm"
    >
      <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
      <span>{ru.pwa.updateReady}</span>
      <Button size="sm" className="ml-auto" onClick={update}>
        {ru.pwa.update}
      </Button>
    </div>
  )
}
