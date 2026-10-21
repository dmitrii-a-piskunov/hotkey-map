import type { CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import type { LabelLang } from '@/domain/input'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

/** Отступ корпуса вокруг клавиш, в юнитах */
export const KEYBOARD_PADDING = 0.35
/** Зазор между клавишами, в юнитах */
const KEY_GAP = 0.08

interface KeyboardProps {
  layout: KeyboardLayout
  /** Размер юнита, px */
  unit: number
  labelLang: LabelLang
  selected: ReadonlySet<InputCode>
  pressed: ReadonlySet<InputCode>
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

function KeyLabels({ keyDef, labelLang }: { keyDef: KeyDef; labelLang: LabelLang }) {
  const { en, ru: ruLabel } = keyDef.label
  if (!ruLabel) {
    return <span className="absolute top-[0.35em] left-[0.45em] leading-none">{en}</span>
  }
  // FR-04: подписи активного языка яркие, второго — бледные
  return (
    <>
      <span
        className={cn(
          'absolute top-[0.35em] left-[0.45em] leading-none',
          labelLang !== 'en' && 'opacity-35',
        )}
      >
        {en}
      </span>
      <span
        className={cn(
          'absolute right-[0.45em] bottom-[0.3em] leading-none text-(--key-label-alt)',
          labelLang !== 'ru' && 'opacity-35',
        )}
      >
        {ruLabel}
      </span>
    </>
  )
}

/** Клавиатура AULA F75 (FR-01). Раскладка — данные, компонент только рисует */
export function Keyboard({ layout, unit, labelLang, selected, pressed, onSelect }: KeyboardProps) {
  const pad = KEYBOARD_PADDING * unit
  const gap = KEY_GAP * unit
  const style = {
    width: (layout.width + KEYBOARD_PADDING * 2) * unit,
    height: (layout.height + KEYBOARD_PADDING * 2) * unit,
    fontSize: unit * 0.22,
    borderRadius: unit * 0.3,
    '--case-depth': `${unit * 0.45}px`,
  } as CSSProperties

  return (
    <div role="group" aria-label={ru.devices.keyboard} className="device-body" style={style}>
      <div className="device-body-front" aria-hidden="true" />
      {layout.knob && (
        <div
          role="img"
          aria-label={`${ru.devices.knob}. ${ru.devices.notAssignable}`}
          className="absolute rounded-full bg-(--knob) shadow-[inset_0_-0.2em_0.4em_oklch(0_0_0/35%)]"
          style={{
            left: pad + (layout.knob.cx - layout.knob.d / 2) * unit,
            top: pad + (layout.knob.cy - layout.knob.d / 2) * unit,
            width: layout.knob.d * unit,
            height: layout.knob.d * unit,
            transform: `translateZ(${unit * 0.2}px)`,
          }}
        />
      )}
      {layout.keys.map((k) => (
        <InputCap
          key={k.code}
          code={k.code}
          kind="key"
          left={pad + k.x * unit + gap / 2}
          top={pad + k.y * unit + gap / 2}
          width={k.w * unit - gap}
          height={k.h * unit - gap}
          depth={unit * 0.28}
          ariaLabel={k.assignable ? k.label.en : `${k.label.en}. ${ru.devices.notAssignable}`}
          selected={selected.has(k.code)}
          pressed={pressed.has(k.code)}
          disabled={!k.assignable}
          onSelect={onSelect}
        >
          <KeyLabels keyDef={k} labelLang={labelLang} />
        </InputCap>
      ))}
    </div>
  )
}
