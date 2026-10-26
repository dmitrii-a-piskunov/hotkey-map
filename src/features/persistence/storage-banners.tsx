/**
 * Плашки под шапкой: вторая вкладка (FR-27), режим Firefox и напоминание об экспорте (FR-23),
 * ошибка записи с повтором (раздел 13.1). Статус сохранения — в шапке.
 */

import { AlertTriangle, Check, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { exportToFile } from '@/features/transfer/export'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePersistence } from './persistence-context'
import { usePersistenceStatus } from './status-store'

const t = ru.storage

function Banner({
  tone,
  children,
  action,
}: {
  tone: 'info' | 'error'
  children: ReactNode
  action?: ReactNode
}) {
  const Icon = tone === 'error' ? AlertTriangle : Info
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex min-h-9 items-center gap-2 border-b px-4 py-1 text-sm',
        tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}

export function StorageBanners() {
  const session = usePersistence()
  const mode = usePersistenceStatus((s) => s.mode)
  const saveStatus = usePersistenceStatus((s) => s.saveStatus)
  const saveError = usePersistenceStatus((s) => s.saveError)
  const exportReminder = usePersistenceStatus((s) => s.exportReminder)
  const readOnly = usePersistenceStatus((s) => s.readOnly)

  return (
    <>
      {readOnly && <Banner tone="info">{t.otherTab}</Banner>}
      {mode === 'browser' && <Banner tone="info">{t.browserMode}</Banner>}
      {exportReminder && (
        <Banner
          tone="info"
          action={
            <span className="flex gap-2">
              <Button size="sm" onClick={() => void exportToFile(session, { scope: 'all' })}>
                {t.exportNow}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  session.dismissExportReminder()
                }}
              >
                {t.later}
              </Button>
            </span>
          }
        >
          {t.exportReminder}
        </Banner>
      )}
      {saveStatus === 'error' && saveError === 'permission' && (
        <Banner
          tone="error"
          action={
            <Button size="sm" variant="outline" onClick={() => void session.grantPermission()}>
              {t.allowAccess}
            </Button>
          }
        >
          {t.saveNoPermission}
        </Banner>
      )}
      {saveStatus === 'error' && saveError === 'io' && (
        <Banner
          tone="error"
          action={
            <Button size="sm" variant="outline" onClick={() => void session.retrySave()}>
              {t.retry}
            </Button>
          }
        >
          {t.saveFailed}
        </Banner>
      )}
    </>
  )
}

/** FR-19: «Сохранено», «Сохранение…», «Ошибка сохранения» в шапке */
export function SaveStatusIndicator() {
  const status = usePersistenceStatus((s) => s.saveStatus)
  const mode = usePersistenceStatus((s) => s.mode)
  const folderName = usePersistenceStatus((s) => s.folderName)
  const where =
    mode === 'browser' ? t.browserHint : folderName ? fill(t.folderHint, { name: folderName }) : ''

  return (
    <span
      aria-live="polite"
      data-testid="save-status"
      title={where}
      data-save-status={status}
      className={cn(
        'flex items-center gap-1.5 text-xs whitespace-nowrap',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {status === 'saved' && <Check className="size-3.5" aria-hidden="true" />}
      {status === 'saving' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      {status === 'error' && <AlertTriangle className="size-3.5" aria-hidden="true" />}
      {/* На узком окне шапке не хватает места: «Сохранено» — значком, ошибка — всегда словами */}
      <span className={status === 'error' ? undefined : 'max-2xl:sr-only'}>
        {status === 'saved' ? t.statusSaved : status === 'saving' ? t.statusSaving : t.statusError}
      </span>
    </span>
  )
}
