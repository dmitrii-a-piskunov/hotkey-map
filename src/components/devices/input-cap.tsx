import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import { useCurrentGameName } from '@/features/devices/blocked-keys'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { deviceTheme } from '@/styles/device-theme'

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
  /** Конфликт или нарушение правил (FR-15) */
  conflict?: boolean
  /** Приглушён: чужой слой или поиск (FR-14, FR-16) */
  dimmed?: boolean
  /** Полное название действия — подсказка браузера */
  title?: string
  className?: string
  /** Где показывать подсказку у неназначаемого входа: над ним или под ним (нижний ряд) */
  hintPlacement?: 'below' | 'above'
  /** Дополнительные стили, например CSS-переменные цвета клавиши */
  style?: CSSProperties
  onSelect: (code: InputCode, mods: ClickModifiers) => void
  children?: ReactNode
}

/** Отступ подсказки от клавиши, px */
const HINT_GAP = 6

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
  conflict = false,
  dimmed = false,
  title,
  className,
  hintPlacement = 'above',
  style,
  onSelect,
  children,
}: InputCapProps) {
  // Неназначаемый вход (Fn, регулятор, непередаваемые клавиши игры): пока зажата левая кнопка мыши —
  // красная рамка, штриховка и подсказка. Выделенный такой вход остаётся
  // красным и после отпускания, подсказка — только при удержании
  const [holding, setHolding] = useState(false)
  // Где показать подсказку: она рисуется поверх всего экрана (портал в body),
  // а сама клавиша остаётся на своём месте среди соседей
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  // FR-01: «Эта клавиша не передаётся в Dota 2»; без игр — общий текст
  const gameName = useCurrentGameName()
  const stopReject = useRef<(() => void) | null>(null)
  useEffect(() => () => stopReject.current?.(), [])

  function startReject(target: HTMLElement) {
    stopReject.current?.()
    setAnchor(target.getBoundingClientRect())
    setHolding(true)
    const stop = () => {
      setHolding(false)
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
      data-conflict={conflict || undefined}
      data-dimmed={dimmed || undefined}
      title={title}
      data-rejected={holding || (disabled && selected) || undefined}
      className={cn('cap', className)}
      style={{ left, top, width, height, ...style }}
      onPointerDown={(e) => {
        // Рамку и анимацию нажатия ведёт сцена; здесь только отказ для непередаваемых клавиш
        if (disabled && e.button === 0) startReject(e.currentTarget)
      }}
      onClick={(e) => {
        // Клик мышью (detail ≥ 1) выделяет сцена по нажатию и отпусканию;
        // здесь — программный клик и клик без указателя
        if (e.detail > 0) return
        onSelect(code, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
      }}
    >
      {children}
      {holding &&
        anchor &&
        createPortal(
          <span
            role="status"
            className="cap-hint"
            data-place={hintPlacement}
            style={{
              left: anchor.left + anchor.width / 2,
              top: hintPlacement === 'below' ? anchor.bottom + HINT_GAP : anchor.top - HINT_GAP,
            }}
          >
            {gameName === undefined
              ? ru.devices.notPassedToGames
              : fill(ru.devices.notPassedToGame, { game: gameName })}
          </span>,
          document.body,
        )}
    </div>
  )
})

/** Знак — 70 % значка; ширина и высота — от своего font-size */
const BADGE_GLYPH = 0.7
const BADGE_STYLE = {
  width: `${1 / BADGE_GLYPH}em`,
  height: `${1 / BADGE_GLYPH}em`,
  fontSize: `${deviceTheme.paint.badgeSize * BADGE_GLYPH}em`,
}

/** Значок конфликта в углу верхней грани (FR-15); размер — от юнита в font-size */
export function ConflictBadge() {
  return (
    <span aria-hidden="true" className="cap-badge" style={BADGE_STYLE}>
      !
    </span>
  )
}
