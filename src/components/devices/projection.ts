/**
 * Плоская перспективная проекция для вида 3D (FR-01, FR-02).
 *
 * Устройство наклоняется на rotateX и смотрится с расстояния perspective,
 * как CSS perspective + rotateX, но точки считаются в JS и рисуются плоско
 * в SVG. Текст остаётся прямым, браузеру не нужно сортировать 3D-слои.
 * Все координаты — в юнитах раскладки, z — высота над корпусом.
 */

export interface Vec {
  x: number
  y: number
}

export interface Camera {
  /** Расстояние до зрителя, в юнитах */
  perspective: number
  sin: number
  cos: number
  /** Центр наклона в координатах раскладки */
  center: Vec
}

export function makeCamera(perspectiveUnits: number, rotateXDeg: number, center: Vec): Camera {
  const a = (rotateXDeg * Math.PI) / 180
  return { perspective: perspectiveUnits, sin: Math.sin(a), cos: Math.cos(a), center }
}

/** Масштаб перспективы в точке: больше 1 — ближе к зрителю */
export function scaleAt(cam: Camera, y: number, z = 0): number {
  const dy = y - cam.center.y
  return cam.perspective / (cam.perspective - (dy * cam.sin + z * cam.cos))
}

/**
 * Проекция точки (x, y, z) — та же, что даёт CSS perspective + rotateX,
 * поэтому рисунок совпадает с превью docs/images/device-3d-*.png.
 */
export function project(cam: Camera, x: number, y: number, z = 0): Vec {
  const dy = y - cam.center.y
  const s = scaleAt(cam, y, z)
  return { x: (x - cam.center.x) * s, y: (dy * cam.cos - z * cam.sin) * s }
}

/**
 * Поднятая точка: по вертикали — точная проекция, по горизонтали — как у
 * основания. Горизонтальный сдвиг верхних граней задаёт тема
 * (capShape3d.perspectiveShift), иначе он сложился бы с перспективой дважды.
 */
export function projectRaised(cam: Camera, x: number, y: number, z: number): Vec {
  return { x: project(cam, x, y).x, y: project(cam, x, y, z).y }
}

/** Контур скруглённого прямоугольника по часовой стрелке */
export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  samples = 4,
): Vec[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr === 0) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }
  const corners = [
    { cx: x + w - rr, cy: y + rr, from: -Math.PI / 2 },
    { cx: x + w - rr, cy: y + h - rr, from: 0 },
    { cx: x + rr, cy: y + h - rr, from: Math.PI / 2 },
    { cx: x + rr, cy: y + rr, from: Math.PI },
  ]
  const points: Vec[] = []
  for (const c of corners) {
    for (let i = 0; i <= samples; i++) {
      const a = c.from + (Math.PI / 2) * (i / samples)
      points.push({ x: c.cx + rr * Math.cos(a), y: c.cy + rr * Math.sin(a) })
    }
  }
  return points
}

export function circle(cx: number, cy: number, r: number, samples = 32): Vec[] {
  return Array.from({ length: samples }, (_, i) => {
    const a = (2 * Math.PI * i) / samples
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** Добавляет точку в цепочку оболочки, убирая точки с поворотом не влево */
function pushHull(chain: Vec[], pt: Vec): void {
  for (;;) {
    const a = chain.at(-2)
    const b = chain.at(-1)
    if (!a || !b) break
    if ((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x) > 0) break
    chain.pop()
  }
  chain.push(pt)
}

/** Выпуклая оболочка (монотонная цепочка Эндрю) */
export function convexHull(points: Vec[]): Vec[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const lower: Vec[] = []
  for (const pt of p) {
    pushHull(lower, pt)
  }
  const upper: Vec[] = []
  for (const pt of [...p].reverse()) {
    pushHull(upper, pt)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export function boundsOf(points: Vec[]): Bounds {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Атрибут points для SVG: сдвиг к началу и перевод в пиксели */
export function svgPoints(points: Vec[], origin: Vec, scale: number): string {
  return points
    .map((p) => `${((p.x - origin.x) * scale).toFixed(2)},${((p.y - origin.y) * scale).toFixed(2)}`)
    .join(' ')
}

/**
 * Перспективное преобразование прямоугольника w×h (начало в левом верхнем
 * углу) в четырёхугольник quad = [ЛВ, ПВ, ПН, ЛН]. Возвращает значение для
 * CSS transform: matrix3d(...) с transform-origin: 0 0. Это обычная плоская
 * трансформация одного блока, без preserve-3d (Heckbert, square-to-quad).
 */
export function rectToQuad(w: number, h: number, quad: readonly [Vec, Vec, Vec, Vec]): string {
  const [p0, p1, p2, p3] = quad
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y
  let g = 0
  let k = 0
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    k = (dx1 * dy3 - dx3 * dy1) / det
  }
  const a = (p1.x - p0.x + g * p1.x) / w
  const b = (p3.x - p0.x + k * p3.x) / h
  const d = (p1.y - p0.y + g * p1.y) / w
  const e = (p3.y - p0.y + k * p3.y) / h
  const m = [a, d, 0, g / w, b, e, 0, k / h, 0, 0, 1, 0, p0.x, p0.y, 0, 1]
  return `matrix3d(${m.map((v) => +v.toPrecision(10)).join(',')})`
}
