import { memo, type CSSProperties, type ReactNode } from 'react'
import type { ClickModifiers, InputCode } from '@/domain/selection'

export interface InputCapProps {
  code: InputCode
  /** Клавиатура или мышь: рамкой выделяются только клавиши (FR-13) */
  kind: 'key' | 'mouse'
  /** Положение и размер в пикселях */
  left: number
  top: number
  width: number
  height: number
  /** Высота над корпусом в 3D, px */
  depth: number
  radius?: string
  ariaLabel: string
  selected: boolean
  pressed: boolean
  disabled?: boolean
  onSelect: (code: InputCode, mods: ClickModifiers) => void
  children?: ReactNode
}

/** Клавиша или кнопка мыши: верхняя и передняя грани (FR-01, FR-02) */
export const InputCap = memo(function InputCap({
  code,
  kind,
  left,
  top,
  width,
  height,
  depth,
  radius,
  ariaLabel,
  selected,
  pressed,
  disabled = false,
  onSelect,
  children,
}: InputCapProps) {
  const style = {
    left,
    top,
    width,
    height,
    '--cap-depth': `${depth}px`,
    '--cap-radius': radius,
  } as CSSProperties

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
      className="cap"
      style={style}
      onPointerDown={(e) => {
        // Нажатие на клавишу не начинает рамку
        e.stopPropagation()
      }}
      onClick={(e) => {
        if (disabled) return
        onSelect(code, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
      }}
    >
      <div className="cap-top">{children}</div>
      <div className="cap-front" aria-hidden="true" />
    </div>
  )
})
