import { memo, type CSSProperties } from 'react'
import { ConflictBadge, InputCap } from '@/components/devices/input-cap'
import { keyAriaLabel, viewOf, type InputView } from '@/components/devices/input-views'
import { keyboardWidth, keyWells } from '@/components/devices/device-geometry'
import { CAP_VARS, KNOB_CODE, hintPlacementOf, rejectHatch } from '@/components/keyboard/cap-style'
import { KeyLabels } from '@/components/keyboard/key-labels'
import { Keyboard3D } from '@/components/keyboard/keyboard-3d'
import type { LabelMode } from '@/domain/input'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { ViewMode } from '@/domain/types'
import { useBlockedKeys } from '@/features/devices/blocked-keys'
import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import { ru } from '@/i18n/ru'
import { capStyleOf, deviceTheme, type KeyboardColor } from '@/styles/device-theme'

const { case: caseTheme, cap, legend, knob: knobTheme, state } = deviceTheme

/** Верхняя грань в 2D: отступы от основания, в юнитах (1em = 1u) */
const TOP_STYLE: CSSProperties = {
  top: `${cap.topInset.top}em`,
  left: `${cap.topInset.side}em`,
  right: `${cap.topInset.side}em`,
  bottom: `${cap.topInset.bottom}em`,
  borderRadius: `${cap.topRadius}em`,
}

/** Регулятор в 2D: тёмная крышка со светлым ободком одной рамкой — так ободок равномерный */
// Рамка — на внутреннем круге, а не на блоке клавиши: иначе подсказка
// отсчитывалась бы от внутреннего края рамки
const KNOB_STYLE: CSSProperties = { borderRadius: '50%' }
const KNOB_TOP_STYLE: CSSProperties = {
  inset: 0,
  background: knobTheme.cap,
  border: `${cap.topInset.side}em solid ${knobTheme.ring}`,
}

export interface KeyboardProps {
  layout: KeyboardLayout
  /** Размер юнита, px */
  unit: number
  labelLang: LabelMode
  view: ViewMode
  /** Расцветка родных клавиш (FR-01) */
  keyboardColor: KeyboardColor
  selected: ReadonlySet<InputCode>
  pressed: ReadonlySet<InputCode>
  /** Цвет, подпись действия, конфликт и приглушение каждого входа */
  views: ReadonlyMap<string, InputView>
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/** Клавиатура AULA F75 (FR-01). Раскладка и тема — данные, компонент только рисует */
export function Keyboard(props: KeyboardProps) {
  return props.view === '3d' ? <Keyboard3D {...props} /> : <Keyboard2D {...props} />
}

interface Key2DProps {
  keyDef: KeyDef
  left: number
  top: number
  width: number
  height: number
  labelLang: LabelMode
  palette: KeyboardColor
  selected: boolean
  pressed: boolean
  off: boolean
  view: InputView
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/** Клавиша в 2D. Под memo: смена выделения перерисовывает только изменившиеся клавиши */
const Key2D = memo(function Key2D({
  keyDef: k,
  left,
  top,
  width,
  height,
  labelLang,
  palette,
  selected,
  pressed,
  off,
  view,
  onSelect,
}: Key2DProps) {
  return (
    <InputCap
      code={k.code}
      kind="key"
      left={left}
      top={top}
      width={width}
      height={height}
      ariaLabel={keyAriaLabel(k.label.en, off, view)}
      selected={selected}
      pressed={pressed}
      disabled={off}
      conflict={view.conflict}
      dimmed={view.dimmed}
      title={view.title}
      className="key"
      hintPlacement={hintPlacementOf(k)}
      style={view.style ?? CAP_VARS[palette][capStyleOf(k.code)]}
      onSelect={onSelect}
    >
      <div className="key-top" style={TOP_STYLE}>
        <KeyLabels
          keyDef={k}
          labelLang={labelLang}
          action={
            view.label
              ? {
                  label: view.label,
                  extra: view.extra,
                  faceWidth: k.w - cap.gap - 2 * cap.topInset.side,
                }
              : undefined
          }
        />
        {view.conflict && <ConflictBadge />}
      </div>
    </InputCap>
  )
})

function Keyboard2D({
  layout,
  unit,
  labelLang,
  keyboardColor,
  selected,
  pressed,
  views,
  onSelect,
}: KeyboardProps) {
  const blockedKeys = useBlockedKeys()
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
        // Регулятор сверху: светлый ободок и тёмная крышка. Клик — вспышка отказа
        <InputCap
          code={KNOB_CODE}
          kind="knob"
          // Целые пиксели: на дробных сглаживание делает ободок неровным
          left={Math.round(toX(layout.knob.cx - layout.knob.d / 2))}
          top={Math.round(toY(layout.knob.cy - layout.knob.d / 2))}
          width={Math.round(layout.knob.d * unit)}
          height={Math.round(layout.knob.d * unit)}
          ariaLabel={`${ru.devices.knob}. ${ru.devices.notAssignable}`}
          selected={selected.has(KNOB_CODE)}
          pressed={false}
          disabled
          className="knob"
          hintPlacement="above"
          style={KNOB_STYLE}
          onSelect={onSelect}
        >
          <div className="knob-top" style={KNOB_TOP_STYLE} />
        </InputCap>
      )}
      {layout.keys.map((k) => (
        <Key2D
          key={k.code}
          keyDef={k}
          left={toX(k.x) + gap / 2}
          top={toY(k.y) + gap / 2}
          width={k.w * unit - gap}
          height={k.h * unit - gap}
          labelLang={labelLang}
          palette={keyboardColor}
          selected={selected.has(k.code)}
          pressed={pressed.has(k.code)}
          off={!k.assignable || blockedKeys.includes(k.code)}
          view={viewOf(views, k.code)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
