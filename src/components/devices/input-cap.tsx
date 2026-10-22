import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

export interface InputCapProps {
  code: InputCode
  /** Клавиатура, регулятор или мышь; рамкой выделяются клавиши и кнопки мыши (FR-13) */
  kind: 'key' | 'knob' | 'mouse'
  /** Положение и размер в пикселях */
  left: number
  top: number
  width: number
  height: number
  ariaLabel: string
  selected: boolean
  pressed: boolean
  disabled?: boolean
  className?: string
  /** Где показывать подсказку у неназначаемого входа: над ним или под ним (нижний ряд) */
  hintPlacement?: 'below' | 'above'
  /** Дополнительные стили, например CSS-переменные цвета клавиши */
  style?: CSSProperties
  onSelect: (code: InputCode, mods: ClickModifiers) => void
  children?: ReactNode
}

/** Клавиша или зона мыши: клик, состояния и обводка выделения (FR-01, FR-02) */
export const InputCap = memo(function InputCap({
  code,
  kind,
  left,
  top,
  width,
  height,
  ariaLabel,
  selected,
  pressed,
  disabled = false,
  className,
  hintPlacement = 'above',
  style,
  onSelect,
  children,
}: InputCapProps) {
  // Неназначаемый вход (Fn, Win, регулятор): красная рамка, штриховка и
  // подсказка видны, пока зажата левая кнопка мыши, и пропадают при отпускании
  const [rejected, setRejected] = useState(false)
  const stopReject = useRef<(() => void) | null>(null)
  useEffect(() => () => stopReject.current?.(), [])

  function startReject() {
    stopReject.current?.()
    setRejected(true)
    const stop = () => {
      setRejected(false)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      stopReject.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    stopReject.current = stop
  }

  return (
    <div
      role="button"
      aria-label={ariaLabel}
      aria-pressed={disabled ? undefined : selected}
      aria-disabled={disabled || undefined}
      data-input-code={code}
      data-kind={kind}
      data-selected={selected || undefined}
      data-pressed={pressed || undefined}
      data-disabled={disabled || undefined}
      data-rejected={rejected || undefined}
      className={cn('cap', className)}
      style={{ left, top, width, height, ...style }}
      onPointerDown={(e) => {
        // Рамку и анимацию нажатия ведёт сцена; здесь только отказ для Fn, Win, регулятора
        if (disabled && e.button === 0) startReject()
      }}
      onClick={(e) => {
        if (disabled) return
        onSelect(code, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
      }}
    >
      {children}
      {rejected && (
        <span role="status" className="cap-hint" data-place={hintPlacement}>
          {ru.devices.notPassedToGames}
        </span>
      )}
    </div>
  )
})
