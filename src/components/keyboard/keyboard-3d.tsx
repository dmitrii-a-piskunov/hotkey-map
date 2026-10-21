import { memo, useId, useMemo, type CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import { boundsOf, svgPoints, type Bounds, type Vec } from '@/components/devices/projection'
import { CAP_COLORS_3D, CAP_VARS } from '@/components/keyboard/cap-style'
import { KeyLabels } from '@/components/keyboard/key-labels'
import type { KeyboardProps } from '@/components/keyboard/keyboard'
import { keyboard3d, type CapShape3d } from '@/components/keyboard/keyboard-3d-geometry'
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
  const { box, topBox } = shape
  const pts = (p: Vec[]) => svgPoints(p, box, unit)
  const top: CSSProperties = {
    left: (topBox.x - box.x) * unit,
    top: (topBox.y - box.y) * unit,
    width: topBox.w * unit,
    height: (topBox.h * unit) / shape.squash,
    fontSize: unit * shape.scale,
    transform: `scaleY(${shape.squash})`,
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
        <polygon points={pts(shape.top)} fill={`url(#${gradId}-top-${style})`} />
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
              <linearGradient id={`${id}-top-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={CAP_COLORS_3D[s].topFar} />
                <stop offset="1" stopColor={CAP_COLORS_3D[s].topNear} />
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
        {scene.knob && (
          <g>
            <polygon points={px(scene.knob.side)} fill={`url(#${id}-knob)`} />
            <polygon
              points={px(scene.knob.top)}
              fill={knobTheme.cap}
              stroke={knobTheme.ring}
              strokeWidth={knobTheme.ringWidth * unit * scene.knob.scale}
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
      {scene.knob && (
        <div
          role="img"
          aria-label={`${ru.devices.knob}. ${ru.devices.notAssignable}`}
          className="absolute"
          style={knobBox(scene.knob.top, box, unit)}
        />
      )}
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

function knobBox(points: Vec[], origin: Vec, unit: number): CSSProperties {
  const b = boundsOf(points)
  return {
    left: (b.x - origin.x) * unit,
    top: (b.y - origin.y) * unit,
    width: b.w * unit,
    height: b.h * unit,
  }
}
