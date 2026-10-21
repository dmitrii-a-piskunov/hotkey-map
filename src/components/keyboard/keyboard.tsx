import type { CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import { keyboardWidth, keyWells } from '@/components/devices/device-geometry'
import { CAP_VARS, rejectHatch } from '@/components/keyboard/cap-style'
import { KeyLabels } from '@/components/keyboard/key-labels'
import { Keyboard3D } from '@/components/keyboard/keyboard-3d'
import type { LabelLang } from '@/domain/input'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { ViewMode } from '@/features/devices/store'
import type { KeyboardLayout } from '@/layouts/aula-f75'
import { ru } from '@/i18n/ru'
import { capStyleOf, deviceTheme } from '@/styles/device-theme'

const { case: caseTheme, cap, legend, knob: knobTheme, state } = deviceTheme

/** Верхняя грань в 2D: отступы от основания, в юнитах (1em = 1u) */
const TOP_STYLE: CSSProperties = {
  top: `${cap.topInset.top}em`,
  left: `${cap.topInset.side}em`,
  right: `${cap.topInset.side}em`,
  bottom: `${cap.topInset.bottom}em`,
  borderRadius: `${cap.topRadius}em`,
}

export interface KeyboardProps {
  layout: KeyboardLayout
  /** Размер юнита, px */
  unit: number
  labelLang: LabelLang
  view: ViewMode
  selected: ReadonlySet<InputCode>
  pressed: ReadonlySet<InputCode>
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/** Клавиатура AULA F75 (FR-01). Раскладка и тема — данные, компонент только рисует */
export function Keyboard(props: KeyboardProps) {
  return props.view === '3d' ? <Keyboard3D {...props} /> : <Keyboard2D {...props} />
}

function Keyboard2D({ layout, unit, labelLang, selected, pressed, onSelect }: KeyboardProps) {
  const { bezel } = caseTheme
  const gap = cap.gap * unit
  const style = {
    width: keyboardWidth(layout) * unit,
    height: (bezel.top + layout.height + bezel.bottom) * unit,
    fontSize: unit,
    fontFamily: legend.font,
    borderRadius: `${caseTheme.radius}em`,
    '--case': caseTheme.color,
    '--cap-radius': `${cap.radius}em`,
    '--ring': `${state.selected.width}em solid ${state.selected.color}`,
    '--reject-ring': `${state.conflict.width}em solid ${state.conflict.color}`,
    '--reject-hatch': rejectHatch(state.conflict.width, 'em'),
  } as CSSProperties

  const toX = (x: number) => (bezel.left + x) * unit
  const toY = (y: number) => (bezel.top + y) * unit
  const knobInset = cap.topInset.side

  return (
    <div role="group" aria-label={ru.devices.keyboard} className="device-body" style={style}>
      {keyWells(layout).map((w) => (
        <div
          key={`${w.x}-${w.y}`}
          aria-hidden="true"
          className="absolute"
          style={{
            left: toX(w.x) - gap / 2,
            top: toY(w.y) - gap / 2,
            width: w.w * unit + gap,
            height: w.h * unit + gap,
            background: caseTheme.well,
            borderRadius: `${cap.radius}em`,
          }}
        />
      ))}
      {layout.indicator && (
        <div
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            left: toX(layout.indicator.x),
            top: toY(layout.indicator.y),
            width: layout.indicator.w * unit,
            height: layout.indicator.h * unit,
            background: deviceTheme.indicator.color,
          }}
        />
      )}
      {layout.knob && (
        <>
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              left: toX(layout.knob.cx - layout.knob.d / 2),
              top: toY(layout.knob.cy - layout.knob.d / 2),
              width: layout.knob.d * unit,
              height: layout.knob.d * unit,
              background: `linear-gradient(${knobTheme.side}, ${knobTheme.sideDark})`,
            }}
          />
          <div
            role="img"
            aria-label={`${ru.devices.knob}. ${ru.devices.notAssignable}`}
            className="absolute rounded-full"
            style={{
              left: toX(layout.knob.cx - layout.knob.d / 2 + knobInset),
              top: toY(layout.knob.cy - layout.knob.d / 2 + knobInset),
              width: (layout.knob.d - knobInset * 2) * unit,
              height: (layout.knob.d - knobInset * 2) * unit,
              background: knobTheme.cap,
              border: `${knobTheme.ringWidth}em solid ${knobTheme.ring}`,
            }}
          />
        </>
      )}
      {layout.keys.map((k) => (
        <InputCap
          key={k.code}
          code={k.code}
          kind="key"
          left={toX(k.x) + gap / 2}
          top={toY(k.y) + gap / 2}
          width={k.w * unit - gap}
          height={k.h * unit - gap}
          ariaLabel={k.assignable ? k.label.en : `${k.label.en}. ${ru.devices.notAssignable}`}
          selected={selected.has(k.code)}
          pressed={pressed.has(k.code)}
          disabled={!k.assignable}
          className="key"
          style={CAP_VARS[capStyleOf(k.code)]}
          onSelect={onSelect}
        >
          <div className="key-top" style={TOP_STYLE}>
            <KeyLabels keyDef={k} labelLang={labelLang} />
          </div>
        </InputCap>
      ))}
    </div>
  )
}
