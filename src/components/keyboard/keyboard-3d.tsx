import { memo, useId, useMemo, type CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import {
  boundsOf,
  rectToQuad,
  svgPoints,
  type Bounds,
  type Vec,
} from '@/components/devices/projection'
import { CAP_COLORS_3D, CAP_VARS, KNOB_CODE, rejectHatch } from '@/components/keyboard/cap-style'
import { KeyLabels } from '@/components/keyboard/key-labels'
import type { KeyboardProps } from '@/components/keyboard/keyboard'
import {
  keyboard3d,
  type CapShape3d,
  type Keyboard3d,
} from '@/components/keyboard/keyboard-3d-geometry'
import type { LabelLang } from '@/domain/input'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { KeyDef } from '@/layouts/aula-f75'
import { ru } from '@/i18n/ru'
import { capStyleOf, deviceTheme, type CapStyle } from '@/styles/device-theme'

const { case: caseTheme, legend, knob: knobTheme, state } = deviceTheme
const STYLES = Object.keys(CAP_COLORS_3D) as CapStyle[]

interface Key3DProps {
  keyDef: KeyDef
  shape: CapShape3d
  /** Начало координат рисунка клавиатуры */
  origin: Bounds
  unit: number
  /** Префикс id градиентов из общего <defs> */
  gradId: string
  labelLang: LabelLang
  selected: boolean
  pressed: boolean
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/** Одна клавиша: грани — многоугольники в своём SVG, подписи — прямой текст сверху */
const Key3D = memo(function Key3D({
  keyDef: k,
  shape,
  origin,
  unit,
  gradId,
  labelLang,
  selected,
  pressed,
  onSelect,
}: Key3DProps) {
  const style = capStyleOf(k.code)
  const { box, topSize } = shape
  const pts = (p: Vec[]) => svgPoints(p, box, unit)
  // Верхняя грань — блок размером с грань в плоскости, переведённый в её
  // трапецию одной плоской трансформацией: фон, подписи и обводка наклонены
  const quad = shape.topQuad.map((p) => ({
    x: (p.x - box.x) * unit,
    y: (p.y - box.y) * unit,
  })) as [Vec, Vec, Vec, Vec]
  const top: CSSProperties = {
    width: topSize.w * unit,
    height: topSize.h * unit,
    fontSize: unit,
    transform: rectToQuad(topSize.w * unit, topSize.h * unit, quad),
  }
  return (
    <InputCap
      code={k.code}
      kind="key"
      left={(box.x - origin.x) * unit}
      top={(box.y - origin.y) * unit}
      width={box.w * unit}
      height={box.h * unit}
      ariaLabel={k.assignable ? k.label.en : `${k.label.en}. ${ru.devices.notAssignable}`}
      selected={selected}
      pressed={pressed}
      disabled={!k.assignable}
      className="cap3d"
      style={CAP_VARS[style]}
      onSelect={onSelect}
    >
      <svg aria-hidden="true" className="cap3d-faces" width={box.w * unit} height={box.h * unit}>
        {shape.left && <polygon points={pts(shape.left)} fill="var(--cap-side-3d)" />}
        {shape.right && <polygon points={pts(shape.right)} fill="var(--cap-side-dark-3d)" />}
        <polygon points={pts(shape.front)} fill={`url(#${gradId}-front-${style})`} />
      </svg>
      <div className="cap3d-top" style={top}>
        <KeyLabels keyDef={k} labelLang={labelLang} />
      </div>
    </InputCap>
  )
})

/**
 * Клавиатура в 3D: перспектива посчитана в JS, всё рисуется плоско.
 * Нет CSS 3D и анимаций форм — переключение вида и нажатия дешёвые.
 */
export function Keyboard3D({
  layout,
  unit,
  labelLang,
  selected,
  pressed,
  onSelect,
}: KeyboardProps) {
  const id = useId()
  const scene = useMemo(() => keyboard3d(layout), [layout])
  const { box } = scene
  const px = (p: Vec[]) => svgPoints(p, box, unit)
  const style = {
    width: box.w * unit,
    height: box.h * unit,
    fontFamily: legend.font,
    '--ring': `${state.selected.width * unit}px solid ${state.selected.color}`,
    '--reject-ring': `${state.conflict.width * unit}px solid ${state.conflict.color}`,
    '--reject-hatch': rejectHatch(state.conflict.width * unit, 'px'),
    '--cap-top-radius': `${deviceTheme.view3d.capShape3d.topRadius}em`,
  } as CSSProperties

  return (
    <div role="group" aria-label={ru.devices.keyboard} className="relative" style={style}>
      <svg
        aria-hidden="true"
        className="device-3d-svg absolute inset-0"
        width={box.w * unit}
        height={box.h * unit}
      >
        <defs>
          {STYLES.map((s) => (
            <g key={s}>
              <linearGradient id={`${id}-front-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={CAP_COLORS_3D[s].frontTop} />
                <stop offset="1" stopColor={CAP_COLORS_3D[s].frontBottom} />
              </linearGradient>
            </g>
          ))}
          <linearGradient id={`${id}-knob`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={knobTheme.side} />
            <stop offset="1" stopColor={knobTheme.sideDark} />
          </linearGradient>
        </defs>
        <polygon points={px(scene.caseFront)} fill={caseTheme.edge} />
        <polygon points={px(scene.caseTop)} fill={caseTheme.color} />
        {scene.wells.map((w, i) => (
          <polygon key={i} points={px(w)} fill={caseTheme.well} />
        ))}
        {scene.indicator && (
          <polygon points={px(scene.indicator)} fill={deviceTheme.indicator.color} />
        )}
        {scene.knob && <polygon points={px(scene.knob.side)} fill={`url(#${id}-knob)`} />}
      </svg>
      {scene.knob && <Knob3D knob={scene.knob} origin={box} unit={unit} onSelect={onSelect} />}
      {scene.keys.map(({ key, up, down }) => {
        const isPressed = pressed.has(key.code)
        const shape = isPressed ? down : up
        return (
          <Key3D
            key={key.code}
            keyDef={key}
            shape={shape}
            origin={box}
            unit={unit}
            gradId={id}
            labelLang={labelLang}
            selected={selected.has(key.code)}
            pressed={isPressed}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

interface Knob3DProps {
  knob: NonNullable<Keyboard3d['knob']>
  origin: Vec
  unit: number
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/**
 * Крышка регулятора: квадрат со скруглением 50 % переведён в проекцию —
 * получается точный эллипс, на который ложатся ободок и штриховка отказа.
 */
const Knob3D = memo(function Knob3D({ knob, origin, unit, onSelect }: Knob3DProps) {
  const box = boundsOf(knob.topQuad)
  const quad = knob.topQuad.map((p) => ({
    x: (p.x - box.x) * unit,
    y: (p.y - box.y) * unit,
  })) as [Vec, Vec, Vec, Vec]
  const size = knob.d * unit
  return (
    <InputCap
      code={KNOB_CODE}
      kind="knob"
      left={(box.x - origin.x) * unit}
      top={(box.y - origin.y) * unit}
      width={box.w * unit}
      height={box.h * unit}
      ariaLabel={`${ru.devices.knob}. ${ru.devices.notAssignable}`}
      selected={false}
      pressed={false}
      disabled
      className="knob knob-3d"
      onSelect={onSelect}
    >
      <div
        className="knob-top"
        style={{
          width: size,
          height: size,
          background: knobTheme.cap,
          border: `${knobTheme.ringWidth * unit}px solid ${knobTheme.ring}`,
          transform: rectToQuad(size, size, quad),
        }}
      />
    </InputCap>
  )
})
