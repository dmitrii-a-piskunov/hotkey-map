import { useEffect, useRef, type CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import { mouseCodeForWheel } from '@/domain/input'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { MouseInputDef, MouseLayout } from '@/layouts/mouse'
import { ru } from '@/i18n/ru'

/** Слева от корпуса торчат боковые кнопки — оставляем под них место, в юнитах */
export const MOUSE_PADDING = 0.4

interface MouseProps {
  layout: MouseLayout
  unit: number
  selected: ReadonlySet<InputCode>
  pressed: ReadonlySet<InputCode>
  onSelect: (code: InputCode, mods: ClickModifiers) => void
  /** Прокрутка над мышью; null — прокрутку не перехватывать */
  onWheelInput: ((code: InputCode) => void) | null
}

function capDepth(input: MouseInputDef, unit: number): number {
  if (input.kind === 'button') return unit * 0.12
  if (input.kind === 'side') return unit * 0.1
  return unit * 0.16
}

function capRadius(input: MouseInputDef, unit: number): string {
  if (input.code === 'MouseLeft')
    return `${unit * 0.6}px ${unit * 0.1}px ${unit * 0.1}px ${unit * 0.1}px`
  if (input.code === 'MouseRight')
    return `${unit * 0.1}px ${unit * 0.6}px ${unit * 0.1}px ${unit * 0.1}px`
  return `${unit * 0.12}px`
}

/** Схематичная мышь (FR-02) */
export function Mouse({ layout, unit, selected, pressed, onSelect, onWheelInput }: MouseProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || !onWheelInput) return
    // Нужен непассивный обработчик, чтобы страница не прокручивалась
    function onWheel(e: WheelEvent) {
      const code = mouseCodeForWheel(layout, e.deltaY)
      if (!code || !onWheelInput) return
      e.preventDefault()
      onWheelInput(code)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [layout, onWheelInput])

  const pad = MOUSE_PADDING * unit
  const bodyStyle = {
    left: pad,
    width: layout.width * unit,
    height: layout.height * unit,
    borderRadius: `${unit * 1.2}px ${unit * 1.2}px ${unit * 1.5}px ${unit * 1.5}px / ${unit * 0.9}px ${unit * 0.9}px ${unit * 2}px ${unit * 2}px`,
  } as CSSProperties

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={ru.devices.mouse}
      className="relative"
      style={{
        width: (layout.width + MOUSE_PADDING) * unit,
        height: layout.height * unit,
        fontSize: unit * 0.22,
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="device-body absolute top-0" style={bodyStyle} />
      {layout.inputs.map((input) => (
        <InputCap
          key={input.code}
          code={input.code}
          kind="mouse"
          left={pad + input.x * unit + 1}
          top={input.y * unit + 1}
          width={input.w * unit - 2}
          height={input.h * unit - 2}
          depth={capDepth(input, unit)}
          radius={capRadius(input, unit)}
          ariaLabel={input.label}
          selected={selected.has(input.code)}
          pressed={pressed.has(input.code)}
          onSelect={onSelect}
        >
          <span
            className={
              input.kind === 'button'
                ? 'absolute top-[0.5em] w-full text-center leading-none'
                : 'absolute inset-0 flex items-center justify-center text-[0.75em] leading-none'
            }
          >
            {input.short}
          </span>
        </InputCap>
      ))}
    </div>
  )
}
