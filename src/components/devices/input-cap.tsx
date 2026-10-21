import { memo, type CSSProperties, type ReactNode } from 'react'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import { cn } from '@/lib/utils'

export interface InputCapProps {
  code: InputCode
  /** Клавиатура или мышь: рамкой выделяются только клавиши (FR-13) */
  kind: 'key' | 'mouse'
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
  style,
  onSelect,
  children,
}: InputCapProps) {
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
      className={cn('cap', className)}
      style={{ left, top, width, height, ...style }}
      onPointerDown={(e) => {
        // Нажатие на клавишу не начинает рамку
        e.stopPropagation()
      }}
      onClick={(e) => {
        if (disabled) return
        onSelect(code, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
      }}
    >
      {children}
    </div>
  )
})
