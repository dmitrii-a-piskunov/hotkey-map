import { memo, useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { ConflictBadge, InputCap } from '@/components/devices/input-cap'
import { keyAriaLabel, viewOf, type InputView } from '@/components/devices/input-views'
import {
  boundsOf,
  rectToQuad,
  svgPoints,
  type Bounds,
  type Vec,
} from '@/components/devices/projection'
import {
  CAP_COLORS_3D,
  CAP_VARS,
  KNOB_CODE,
  hintPlacementOf,
  rejectHatch,
} from '@/components/keyboard/cap-style'
import { KeyLabels } from '@/components/keyboard/key-labels'
import type { KeyboardProps } from '@/components/keyboard/keyboard'
import {
  keyboard3d,
  type CapShape3d,
  type Keyboard3d,
} from '@/components/keyboard/keyboard-3d-geometry'
import type { LabelMode } from '@/domain/input'
import { useBlockedKeys } from '@/features/devices/blocked-keys'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { KeyDef } from '@/layouts/aula-f75'
import { ru } from '@/i18n/ru'
import { capStyleOf, deviceTheme, type CapStyle, type KeyboardColor } from '@/styles/device-theme'

const { case: caseTheme, legend, knob: knobTheme, state } = deviceTheme
const STYLES = Object.keys(CAP_COLORS_3D.standard) as CapStyle[]

interface Key3DProps {
  keyDef: KeyDef
  shape: CapShape3d
  /** Начало координат рисунка клавиатуры */
  origin: Bounds
  unit: number
  /** Префикс id градиентов из общего <defs> */
  gradId: string
  labelLang: LabelMode
  palette: KeyboardColor
  selected: boolean
  pressed: boolean
  view: InputView
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
  palette,
  selected,
  pressed,
  view,
  onSelect,
}: Key3DProps) {
  const style = capStyleOf(k.code)
  const blockedKeys = useBlockedKeys()
  const off = !k.assignable || blockedKeys.includes(k.code)
  const { box, topSize } = shape
  // Форма грани через CSS-свойство d: при нажатии она плавно меняется
  const face = (p: Vec[], fill: string): CSSProperties => ({
    d: `path('M${svgPoints(p, box, unit).replaceAll(' ', 'L')}Z')`,
    fill,
  })
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
      ariaLabel={keyAriaLabel(k.label.en, off, view)}
      selected={selected}
      pressed={pressed}
      disabled={off}
      conflict={view.conflict}
      dimmed={view.dimmed}
      title={view.title}
      className="cap3d"
      hintPlacement={hintPlacementOf(k)}
      style={view.style ?? CAP_VARS[palette][style]}
      onSelect={onSelect}
    >
      <svg aria-hidden="true" className="cap3d-faces" width={box.w * unit} height={box.h * unit}>
        {shape.left && <path style={face(shape.left, 'var(--cap-side-3d)')} />}
        {shape.right && <path style={face(shape.right, 'var(--cap-side-dark-3d)')} />}
        {/* Окрашенная клавиша задаёт --cap-front-3d, родная — градиент своего стиля */}
        <path style={face(shape.front, `var(--cap-front-3d, url(#${gradId}-front-${style}))`)} />
        <path style={face(shape.underlay, 'var(--cap-side-3d)')} />
      </svg>
      <div className="cap3d-top" style={top}>
        <KeyLabels
          keyDef={k}
          labelLang={labelLang}
          action={
            view.label ? { label: view.label, extra: view.extra, faceWidth: topSize.w } : undefined
          }
        />
        {view.conflict && <ConflictBadge />}
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
  keyboardColor,
  selected,
  pressed,
  views,
  onSelect,
}: KeyboardProps) {
  const id = useId()
  const scene = useMemo(() => keyboard3d(layout), [layout])
  // Смена размера (окно, Ctrl+колесо) — без анимации нажатия: иначе все грани
  // плавно перетекали бы к новому размеру и клавиатура «плыла»
  const [sizedUnit, setSizedUnit] = useState(unit)
  const resizing = sizedUnit !== unit
  useEffect(() => {
    if (!resizing) return
    const frame = requestAnimationFrame(() => {
      setSizedUnit(unit)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [resizing, unit])
  const { box } = scene
  const px = (p: Vec[]) => svgPoints(p, box, unit)
  const style = {
    width: box.w * unit,
    height: box.h * unit,
    fontFamily: legend.font,
    '--ring': `${state.selected.width * unit}px solid ${state.selected.color}`,
    '--press-ms': `${deviceTheme.view3d.pressMs}ms`,
    '--reject-ring': `${state.conflict.width * unit}px solid ${state.conflict.color}`,
    '--conflict-ring': `${state.selected.width * unit}px solid ${state.conflict.color}`,
    '--reject-hatch': rejectHatch(state.conflict.width * unit, 'px'),
    '--cap-top-radius': `${deviceTheme.view3d.capShape3d.topRadius}em`,
  } as CSSProperties

  return (
    <div
      role="group"
      aria-label={ru.devices.keyboard}
      className="relative"
      style={style}
      data-instant={resizing || undefined}
    >
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
                <stop offset="0" stopColor={CAP_COLORS_3D[keyboardColor][s].frontTop} />
                <stop offset="1" stopColor={CAP_COLORS_3D[keyboardColor][s].frontBottom} />
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
      {scene.knob && (
        <Knob3D
          knob={scene.knob}
          origin={box}
          unit={unit}
          selected={selected.has(KNOB_CODE)}
          onSelect={onSelect}
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
            palette={keyboardColor}
            selected={selected.has(key.code)}
            pressed={isPressed}
            view={viewOf(views, key.code)}
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
  selected: boolean
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/**
 * Крышка регулятора: квадрат со скруглением 50 % переведён в проекцию —
 * получается точный эллипс, на который ложатся ободок и штриховка отказа.
 */
const Knob3D = memo(function Knob3D({ knob, origin, unit, selected, onSelect }: Knob3DProps) {
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
      selected={selected}
      pressed={false}
      disabled
      className="knob knob-3d"
      hintPlacement="above"
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
