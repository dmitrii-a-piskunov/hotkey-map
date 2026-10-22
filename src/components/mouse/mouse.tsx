import { useId, useMemo, type CSSProperties } from 'react'
import { InputCap } from '@/components/devices/input-cap'
import { svgPoints, type Vec } from '@/components/devices/projection'
import { CALLOUT_GAP, CALLOUT_SIZE, mouseScene } from '@/components/mouse/mouse-geometry'
import type { ClickModifiers, InputCode } from '@/domain/selection'
import type { ViewMode } from '@/domain/types'
import type { MouseLayout } from '@/layouts/mouse'
import { ru } from '@/i18n/ru'
import { deviceTheme } from '@/styles/device-theme'

const { mouse: theme, state } = deviceTheme

interface MouseProps {
  layout: MouseLayout
  unit: number
  view: ViewMode
  selected: ReadonlySet<InputCode>
  pressed: ReadonlySet<InputCode>
  onSelect: (code: InputCode, mods: ClickModifiers) => void
}

/** Мышь (FR-02): силуэт в SVG, в 3D — с перспективой и объёмом; поверх — зоны кнопок */
export function Mouse({ layout, unit, view, selected, pressed, onSelect }: MouseProps) {
  const id = useId()

  const scene = useMemo(() => mouseScene(layout, view), [layout, view])
  // Постоянный объект, чтобы не ломать memo зон
  const zoneStyle = useMemo(
    () =>
      ({
        '--ring': `${state.selected.width * unit}px solid ${state.selected.color}`,
        '--zone-pressed': theme.shading.partHighlight,
      }) as CSSProperties,
    [unit],
  )

  // Зоны кнопок корпуса обрезаны по дуге линии раздела: клик ниже неё — мимо кнопки
  const zoneStyles = useMemo(
    () =>
      new Map(
        scene.zones.map(({ input, box: z, clip }) => {
          if (!clip) return [input.code, zoneStyle]
          const points = clip
            .map((p) => `${((p.x - z.x) * unit).toFixed(1)}px ${((p.y - z.y) * unit).toFixed(1)}px`)
            .join(', ')
          return [input.code, { ...zoneStyle, clipPath: `polygon(${points})` }]
        }),
      ),
    [scene, unit, zoneStyle],
  )

  const { box } = scene
  const is3d = view === '3d'
  const pts = (p: Vec[]) => svgPoints(p, box, unit)
  const at = (p: Vec) => ({ x: (p.x - box.x) * unit, y: (p.y - box.y) * unit })
  const line = ([a, b]: [Vec, Vec], key: number) => {
    const p = at(a)
    const q = at(b)
    return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
  }
  const outline = pts(scene.outline)
  const hl = at(scene.highlight.center)
  const front = scene.frontShade && { from: at(scene.frontShade.from), to: at(scene.frontShade.to) }
  const ringWidth = state.selected.width * unit
  const { shading } = theme

  return (
    <div
      role="group"
      aria-label={ru.devices.mouse}
      className="relative"
      style={{ width: box.w * unit, height: box.h * unit }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 overflow-visible"
        width={box.w * unit}
        height={box.h * unit}
      >
        <defs>
          <clipPath id={`${id}-body`}>
            <polygon points={outline} />
          </clipPath>
          {scene.buttons.map((b) => (
            <g key={b.code}>
              <clipPath id={`${id}-${b.code}`}>
                <polygon points={pts(b.region)} />
              </clipPath>
              {/* Боковые кнопки вырезаны: обводка кнопки огибает их */}
              <mask
                id={`${id}-${b.code}-notch`}
                maskUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={box.w * unit}
                height={box.h * unit}
              >
                <rect width={box.w * unit} height={box.h * unit} fill="white" />
                {b.notches.map((n, i) => (
                  <polygon key={i} points={pts(n)} fill="black" />
                ))}
              </mask>
            </g>
          ))}
          <radialGradient
            id={`${id}-shade`}
            gradientUnits="userSpaceOnUse"
            cx={hl.x}
            cy={hl.y}
            r={scene.highlight.radius * unit}
          >
            <stop offset="0" stopColor={shading.highlight.color} />
            <stop offset="1" stopColor={shading.mid} />
          </radialGradient>
          {front && (
            <linearGradient
              id={`${id}-front`}
              gradientUnits="userSpaceOnUse"
              x1={front.from.x}
              y1={front.from.y}
              x2={front.to.x}
              y2={front.to.y}
            >
              <stop
                offset="0"
                stopColor={shading.frontShade.color}
                stopOpacity={shading.frontShade.opacity}
              />
              <stop offset="1" stopColor={shading.frontShade.color} stopOpacity={0} />
            </linearGradient>
          )}
          {/* Затемнение по контуру: размытая внешняя область, оставленная внутри силуэта */}
          <filter id={`${id}-rim`} x="-10%" y="-10%" width="120%" height="120%">
            <feFlood floodColor={shading.edge} />
            <feComposite in2="SourceAlpha" operator="out" />
            <feGaussianBlur stdDeviation={(shading.rimWidth * unit) / 2} />
            <feComposite in2="SourceAlpha" operator="in" result="rim" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="rim" />
            </feMerge>
          </filter>
        </defs>
        {/* Тень корпуса — как у клавиатуры: в 3D та же, что у её SVG, в 2D — как у корпуса 2D */}
        <g className="mouse-shadow" data-view={view} style={is3d ? undefined : { fontSize: unit }}>
          {scene.sides.map((s, i) => (
            <polygon key={i} points={pts(s)} fill={theme.side} />
          ))}
          {/* Объём — градиент и затемнение по краю, одинаково в 2D и 3D */}
          <polygon points={outline} fill={`url(#${id}-shade)`} filter={`url(#${id}-rim)`} />
          {front && <polygon points={outline} fill={`url(#${id}-front)`} />}
        </g>
        <g stroke={theme.seam} strokeWidth={unit * 0.03} clipPath={`url(#${id}-body)`}>
          {scene.seams.map(line)}
        </g>
        <polygon
          points={pts(scene.wheel)}
          fill={theme.wheel}
          stroke={theme.seam}
          strokeWidth={unit * 0.05}
        />
        <g stroke={theme.wheelTread} strokeWidth={unit * 0.03}>
          {scene.treads.map(line)}
        </g>
        {/* Выноски к подписям входов */}
        <g className="mouse-callout" strokeWidth={unit * 0.02}>
          {scene.callouts.map((c) => {
            const p = at(c.from)
            const q = at(c.to)
            return (
              <g key={c.code}>
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                <circle cx={p.x} cy={p.y} r={unit * 0.04} />
              </g>
            )
          })}
        </g>
        {/* Кнопки корпуса: нажатие и выделение по их части контура */}
        {/* Обводка — одна фигура, обрезанная по себе: толщина везде одинаковая */}
        {scene.buttons.map((b) => (
          <g key={b.code} clipPath={`url(#${id}-${b.code})`}>
            {pressed.has(b.code) && (
              // Подсветка нажатия тоже с вырезом под боковые кнопки
              <polygon
                points={pts(b.region)}
                fill={shading.partHighlight}
                mask={`url(#${id}-${b.code}-notch)`}
              />
            )}
            {selected.has(b.code) && (
              <g
                fill="none"
                stroke={state.selected.color}
                strokeWidth={ringWidth * 2}
                mask={`url(#${id}-${b.code}-notch)`}
              >
                <polygon points={pts(b.region)} />
                {b.notches.map((n, i) => (
                  <polygon key={i} points={pts(n)} />
                ))}
              </g>
            )}
          </g>
        ))}
      </svg>
      {scene.callouts.map((c) => {
        const q = at(c.to)
        const gap = unit * CALLOUT_GAP
        return (
          <span
            key={c.code}
            aria-hidden="true"
            className="mouse-callout-label"
            style={{
              left: c.side === 'left' ? q.x - gap : q.x + gap,
              top: q.y,
              fontSize: unit * CALLOUT_SIZE,
              fontFamily: deviceTheme.legend.font,
              transform: c.side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)',
            }}
          >
            {c.text}
          </span>
        )
      })}
      {scene.zones.map(({ input, box: z }) => (
        <InputCap
          key={input.code}
          code={input.code}
          kind="mouse"
          left={(z.x - box.x) * unit}
          top={(z.y - box.y) * unit}
          width={z.w * unit}
          height={z.h * unit}
          ariaLabel={input.label}
          selected={selected.has(input.code)}
          pressed={pressed.has(input.code)}
          className={input.kind === 'button' ? 'mouse-zone' : 'mouse-zone mouse-zone-ring'}
          style={zoneStyles.get(input.code) ?? zoneStyle}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
