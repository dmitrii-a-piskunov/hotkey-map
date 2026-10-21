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
  scaleAt,
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

export interface CapShape3d {
  /** Боковые грани; null — грань не видна */
  left: Vec[] | null
  right: Vec[] | null
  front: Vec[]
  top: Vec[]
  /** Прямоугольник под подписи — границы верхней грани */
  topBox: Bounds
  /** Масштаб перспективы у верхней грани: им масштабируются подписи */
  scale: number
  /** Сжатие верхней грани по вертикали: подписи сжимаются так же */
  squash: number
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
  knob: { side: Vec[]; top: Vec[]; scale: number } | null
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
  const tTL = raised(tx, ty)
  const tTR = raised(tx + tw, ty)
  const tBR = raised(tx + tw, ty + th)
  const tBL = raised(tx, ty + th)
  const top = roundedRect(tx, ty, tw, th, capShape3d.topRadius).map((p) => raised(p.x, p.y))
  const left = tTL.x - bTL.x > MIN_FACE ? [bTL, tTL, tBL, bBL] : null
  const right = bTR.x - tTR.x > MIN_FACE ? [tTR, bTR, bBR, tBR] : null
  const front = [tBL, tBR, bBR, bBL]
  return {
    left,
    right,
    front,
    top,
    topBox: boundsOf(top),
    scale: scaleAt(cam, ty + th / 2, height),
    squash: cam.cos,
    box: boundsOf([bTL, bTR, bBR, bBL, ...top]),
  }
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
    const top = circle(kn.cx + shift, kn.cy, r - capShape3d.topInsetSide).map((p) =>
      projectRaised(cam, p.x, p.y, capTop),
    )
    knob = { side: convexHull([...base, ...top]), top, scale: scaleAt(cam, kn.cy, capTop) }
  }

  const keys = layout.keys.map((key) => ({
    key,
    up: capShape(cam, key, layout.width, capTop),
    down: capShape(cam, key, layout.width, capPressed),
  }))

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
