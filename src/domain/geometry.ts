/** Простая геометрия для выделения клавиш. Единицы любые: юниты раскладки или пиксели. */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Допуск для сравнения координат: центры клавиш считаются дробными */
export const EPSILON = 1e-6

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Прямоугольник с углами в двух точках, в любом порядке */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

/** Точка внутри прямоугольника, границы включительно */
export function containsPoint(r: Rect, p: Point): boolean {
  return (
    p.x >= r.x - EPSILON &&
    p.x <= r.x + r.w + EPSILON &&
    p.y >= r.y - EPSILON &&
    p.y <= r.y + r.h + EPSILON
  )
}

/** Прямоугольники пересекаются (касание по краю не считается) */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
