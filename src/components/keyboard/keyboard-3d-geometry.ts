import {
  capTiltRise,
  capTopInsets3d,
  keyWells,
  perspectiveShift,
} from '@/components/devices/device-geometry'
import {
  boundsOf,
  circle,
  convexHull,
  makeCamera,
  projectRaised,
  roundedRect,
  type Bounds,
  type Camera,
  type Vec,
} from '@/components/devices/projection'
import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import { deviceTheme } from '@/styles/device-theme'

const { case: caseTheme, cap, view3d } = deviceTheme
const { capShape3d } = view3d

/** Видимую грань уже этой ширины не рисуем, в юнитах */
const MIN_FACE = 0.005
/** Насколько подложка верхней грани заходит под соседние грани, в юнитах */
const UNDERLAY_OVERLAP = 0.01

/** x на прямой через точки a и b при данном y (прямая продолжается за точки) */
function xAt(a: Vec, b: Vec, y: number): number {
  return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)
}

/**
 * Горизонтальный сдвиг, который возвращает точки верхней грани внутрь линий
 * левого и правого бока основания [ЛВ, ПВ, ПН, ЛН]. 0 — грань и так внутри.
 */
function insideSides(base: [Vec, Vec, Vec, Vec], top: Vec[]): number {
  const [bTL, bTR, bBR, bBL] = base
  const outLeft = Math.max(0, ...top.map((p) => xAt(bBL, bTL, p.y) - p.x))
  const outRight = Math.max(0, ...top.map((p) => p.x - xAt(bBR, bTR, p.y)))
  return outLeft - outRight
}

/** Точки дуги окружности от угла a0 до a1 (по часовой на экране) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, samples = 4): Vec[] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / samples
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

export interface CapShape3d {
  /** Боковые грани; null — грань не видна */
  left: Vec[] | null
  right: Vec[] | null
  front: Vec[]
  /** Углы верхней грани на экране: ЛВ, ПВ, ПН, ЛН */
  topQuad: [Vec, Vec, Vec, Vec]
  /**
   * Подложка под верхней гранью в цвет боковой грани: передние углы острые
   * (под скруглением видна грань клавиши), задние скруглены как сама грань
   * (там грань нависает над основанием). Чуть заходит под соседние грани,
   * чтобы на стыках не просвечивала тёмная подложка корпуса.
   */
  underlay: Vec[]
  /** Размер верхней грани в плоскости клавиатуры, в юнитах */
  topSize: { w: number; h: number }
  /** Границы всей клавиши */
  box: Bounds
}

export interface Key3d {
  key: KeyDef
  up: CapShape3d
  down: CapShape3d
}

export interface Keyboard3d {
  /** Границы всего рисунка, включая толщину корпуса */
  box: Bounds
  caseTop: Vec[]
  caseFront: Vec[]
  wells: Vec[][]
  indicator: Vec[] | null
  /** Регулятор: боковина и углы квадрата вокруг крышки на экране (ЛВ, ПВ, ПН, ЛН) */
  knob: { side: Vec[]; topQuad: [Vec, Vec, Vec, Vec]; d: number } | null
  keys: Key3d[]
}

function capShape(cam: Camera, k: KeyDef, width: number, height: number): CapShape3d {
  const g = cap.gap
  const x = k.x + g / 2
  const y = k.y + g / 2
  const w = k.w - g
  const h = k.h - g
  const ins = capTopInsets3d(k, width)
  const base = (px: number, py: number) => projectRaised(cam, px, py, 0)
  const bTL = base(x, y)
  const bTR = base(x + w, y)
  const bBR = base(x + w, y + h)
  const bBL = base(x, y + h)
  const tx = x + ins.left
  const ty = y + ins.top
  const tw = w - ins.left - ins.right
  const th = h - ins.top - ins.bottom
  // Наклон по ряду: высота меняется от заднего края грани к переднему
  const rise = capTiltRise(k)
  const raised = (px: number, py: number) =>
    projectRaised(cam, px, py, height + rise * (1 - (2 * (py - ty)) / th))
  const topPlan: Vec[] = [
    { x: tx, y: ty },
    { x: tx + tw, y: ty },
    { x: tx + tw, y: ty + th },
    { x: tx, y: ty + th },
  ]
  const r = Math.min(capShape3d.topRadius, tw / 2, th / 2)
  const o = UNDERLAY_OVERLAP
  const underlayPlan = [
    ...arc(tx + r, ty + r, r, Math.PI, 1.5 * Math.PI),
    ...arc(tx + tw - r, ty + r, r, 1.5 * Math.PI, 2 * Math.PI),
    { x: tx + tw + o, y: ty + r },
    { x: tx + tw + o, y: ty + th + o },
    { x: tx - o, y: ty + th + o },
    { x: tx - o, y: ty + r },
  ]
  // Верхняя грань не должна выходить за линии боков основания: поднятые точки
  // рисуются выше, и у крайних клавиш их угол выступал бы за бок
  const shift = insideSides(
    [bTL, bTR, bBR, bBL],
    [...topPlan, ...underlayPlan].map((p) => raised(p.x, p.y)),
  )
  const lift = (p: Vec) => {
    const q = raised(p.x, p.y)
    return { x: q.x + shift, y: q.y }
  }
  const [tTL, tTR, tBR, tBL] = topPlan.map(lift) as [Vec, Vec, Vec, Vec]
  const underlay = underlayPlan.map(lift)
  const left = tTL.x - bTL.x > MIN_FACE ? [bTL, tTL, tBL, bBL] : null
  const right = bTR.x - tTR.x > MIN_FACE ? [tTR, bTR, bBR, tBR] : null
  const front = [tBL, tBR, bBR, bBL]
  return {
    left,
    right,
    front,
    topQuad: [tTL, tTR, tBR, tBL],
    underlay,
    topSize: { w: tw, h: th },
    box: boundsOf([bTL, bTR, bBR, bBL, tTL, tTR, tBR, tBL]),
  }
}

function corners(b: Bounds): Vec[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
  ]
}

/**
 * Клавиатура в 3D как на превью docs/images/device-3d-*.png: корпус —
 * трапеция с толщиной, клавиши — усечённые пирамиды с гранями-трапециями.
 */
export function keyboard3d(layout: KeyboardLayout): Keyboard3d {
  const { bezel } = caseTheme
  const x0 = -bezel.left
  const y0 = -bezel.top
  const cw = bezel.left + layout.width + bezel.right
  const ch = bezel.top + layout.height + bezel.bottom
  const cam = makeCamera(view3d.perspectivePx / deviceTheme.unitPx, view3d.rotateX, {
    x: x0 + cw / 2,
    y: y0 + ch / 2,
  })
  // Высота клавиши как на превью — capHeight; при нажатии она меньше на pressDepth
  const capTop = view3d.capHeight
  const capPressed = capTop - view3d.pressDepth

  const outline = roundedRect(x0, y0, cw, ch, caseTheme.radius, 8)
  const caseTop = outline.map((p) => projectRaised(cam, p.x, p.y, 0))
  // Толщина корпуса — полоса под ним в плоскости клавиатуры, как на превью
  const caseFront = outline.map((p) => projectRaised(cam, p.x, p.y + caseTheme.height3d, 0))

  const g = cap.gap
  const wells = keyWells(layout).map((r) =>
    roundedRect(r.x - g / 2, r.y - g / 2, r.w + g, r.h + g, cap.radius).map((p) =>
      projectRaised(cam, p.x, p.y, 0),
    ),
  )

  const ind = layout.indicator
  const indicator = ind
    ? roundedRect(ind.x, ind.y, ind.w, ind.h, ind.w / 2).map((p) => projectRaised(cam, p.x, p.y, 0))
    : null

  const kn = layout.knob
  let knob: Keyboard3d['knob'] = null
  if (kn) {
    const r = kn.d / 2
    const shift = perspectiveShift(kn.cx, layout.width)
    const base = circle(kn.cx, kn.cy, r).map((p) => projectRaised(cam, p.x, p.y, 0))
    // Цилиндр: верх того же диаметра, что низ, поднят до верха клавиш и
    // сдвинут по той же перспективе
    const tx = kn.cx + shift
    const up = (px: number, py: number) => projectRaised(cam, px, py, capTop)
    const top = circle(tx, kn.cy, r).map((p) => up(p.x, p.y))
    knob = {
      side: convexHull([...base, ...top]),
      topQuad: [
        up(tx - r, kn.cy - r),
        up(tx + r, kn.cy - r),
        up(tx + r, kn.cy + r),
        up(tx - r, kn.cy + r),
      ],
      d: kn.d,
    }
  }

  const keys = layout.keys.map((key) => {
    const up = capShape(cam, key, layout.width, capTop)
    const down = capShape(cam, key, layout.width, capPressed)
    // Общие границы: при нажатии блок клавиши не сдвигается, двигаются только грани
    const box = boundsOf([...corners(up.box), ...corners(down.box)])
    return { key, up: { ...up, box }, down: { ...down, box } }
  })

  return {
    box: boundsOf([...caseTop, ...caseFront]),
    caseTop,
    caseFront,
    wells,
    indicator,
    knob,
    keys,
  }
}
