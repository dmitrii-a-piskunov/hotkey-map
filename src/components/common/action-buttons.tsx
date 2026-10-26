/** Кнопки действий с ожиданием и подтверждением на месте: экраны запуска, «Настройки» */

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ru } from '@/i18n/ru'

const t = ru.storage

/** Кнопка асинхронного действия: недоступна, пока действие идёт */
export function ActionButton({
  onClick,
  children,
  variant,
  disabled,
}: {
  onClick: () => Promise<void>
  children: ReactNode
  variant?: 'default' | 'outline'
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant={variant}
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true)
        void onClick().finally(() => {
          setBusy(false)
        })
      }}
    >
      {children}
    </Button>
  )
}

/** Строка с действием и подтверждением на месте: «Восстановить» → «Да / Отмена» */
export function ConfirmRow({
  label,
  question,
  action,
  onConfirm,
  disabled,
}: {
  label: ReactNode
  question: string
  action: string
  onConfirm: () => Promise<void>
  disabled?: boolean
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <div className="flex items-center justify-between gap-3">
        {label}
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setAsking(true)
          }}
        >
          {action}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{question}</span>
      <div className="flex gap-2">
        <ActionButton onClick={onConfirm}>{t.confirm}</ActionButton>
        <Button
          variant="outline"
          onClick={() => {
            setAsking(false)
          }}
        >
          {t.cancel}
        </Button>
      </div>
    </div>
  )
}
