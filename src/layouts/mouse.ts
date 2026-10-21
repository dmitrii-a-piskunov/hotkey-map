/**
 * Раскладка мыши: две основные кнопки, колесо и две боковые кнопки.
 *
 * Координаты — в юнитах внутри прямоугольника мыши (ширина 3, высота 6),
 * так же как у клавиатуры. Силуэт корпуса строит mouseOutline(): сплюснутый
 * полуэллипс спереди, прямые бока, полукруглая спинка и впадинка у колеса. Параметры формы — deviceTheme.mouse.shape.
 *
 * Коды входов совпадают с ТЗ (раздел 9.1): MouseLeft, MouseRight,
 * MouseMiddle, WheelUp, WheelDown, Mouse4, Mouse5.
 */

export type MouseInputCode =
  'MouseLeft' | 'MouseRight' | 'MouseMiddle' | 'WheelUp' | 'WheelDown' | 'Mouse4' | 'Mouse5'

export interface MouseInputDef {
  code: MouseInputCode
  /** Короткая подпись на зоне */
  short: string
  /** Полное название для панели и подсказок */
  label: string
  /** Зона на изображении, в юнитах */
  x: number
  y: number
  w: number
  h: number
  /** Как показывать зону: кнопка корпуса, колесо, стрелка прокрутки, боковая кнопка */
  kind: 'button' | 'wheel' | 'scroll' | 'side'
  /**
   * Значение MouseEvent.button для кнопок; для прокрутки — направление deltaY.
   * Нужно, чтобы связать настоящую мышь с зоной на экране (ТЗ, FR-03).
   */
  match: { button: number } | { wheel: 'up' | 'down' }
}

export interface MouseLayout {
  id: string
  name: string
  width: number
  height: number
  inputs: MouseInputDef[]
}

export interface MouseShape {
  /**
   * Глубина переднего закругления, в юнитах: перед — сплюснутый полуэллипс
   * шириной во весь корпус. Меньше — перед площе, равно половине ширины — полукруг.
   */
  frontDepth: number
  /** Глубина впадинки у колеса на переднем краю, в юнитах */
  notch: number
  /** Ширина впадинки, в юнитах */
  notchWidth: number
}

export interface Point {
  x: number
  y: number
}

/**
 * Контур корпуса мыши по часовой стрелке, начиная с центра переднего края.
 * Одна плавная линия: сплюснутый полуэллипс спереди, прямые бока,
 * полукруглая спинка, неглубокая впадинка у колеса.
 * Координаты в юнитах, (0, 0) — левый верхний угол прямоугольника мыши.
 */
export function mouseOutline(
  width: number,
  height: number,
  shape: MouseShape,
  samples = 64,
): Point[] {
  const cx = width / 2
  const half = width / 2
  const frontCenterY = shape.frontDepth
  const backCenterY = height - half
  const right: Point[] = []

  // Перед: четверть сплюснутого эллипса от центра до бока.
  // В центре касательная горизонтальная, у бока — вертикальная, поэтому без изломов.
  for (let i = 0; i <= samples; i++) {
    const ang = (Math.PI / 2) * (i / samples)
    const x = cx + half * Math.sin(ang)
    const dx = x - cx
    // Впадинка у колеса: плавная «ложбинка» без острых углов
    const dip = shape.notch * Math.exp(-((dx / (shape.notchWidth / 2)) ** 2) * 2)
    right.push({ x, y: frontCenterY - shape.frontDepth * Math.cos(ang) + dip })
  }
  // Прямой бок до начала спинки
  right.push({ x: width, y: backCenterY })
  // Полукруглая спинка до центра
  for (let i = 1; i <= samples; i++) {
    const a = (Math.PI / 2) * (i / samples)
    right.push({ x: cx + half * Math.cos(a), y: backCenterY + half * Math.sin(a) })
  }

  // Левая половина — зеркало правой
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => ({ x: width - p.x, y: p.y }))
  return [...right, ...left]
}

/** SVG-путь контура для атрибута d */
export function mouseOutlinePath(width: number, height: number, shape: MouseShape): string {
  const pts = mouseOutline(width, height, shape)
  return (
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z'
  )
}

export const mouse2Side: MouseLayout = {
  id: 'mouse-2-side',
  name: 'Мышь с двумя боковыми кнопками',
  width: 3,
  height: 6,
  inputs: [
    {
      code: 'MouseLeft',
      short: 'ЛКМ',
      label: 'Левая кнопка мыши',
      x: 0,
      y: 0,
      w: 1.27,
      h: 2.28,
      kind: 'button',
      match: { button: 0 },
    },
    {
      code: 'MouseRight',
      short: 'ПКМ',
      label: 'Правая кнопка мыши',
      x: 1.73,
      y: 0,
      w: 1.27,
      h: 2.28,
      kind: 'button',
      match: { button: 2 },
    },
    {
      code: 'WheelUp',
      short: '▲',
      label: 'Колесо вверх',
      x: 1.27,
      y: 0.12,
      w: 0.46,
      h: 0.3,
      kind: 'scroll',
      match: { wheel: 'up' },
    },
    {
      code: 'MouseMiddle',
      short: 'СКМ',
      label: 'Нажатие колеса',
      x: 1.27,
      y: 0.42,
      w: 0.46,
      h: 0.85,
      kind: 'wheel',
      match: { button: 1 },
    },
    {
      code: 'WheelDown',
      short: '▼',
      label: 'Колесо вниз',
      x: 1.27,
      y: 1.27,
      w: 0.46,
      h: 0.3,
      kind: 'scroll',
      match: { wheel: 'down' },
    },
    {
      code: 'Mouse5',
      short: 'M5',
      label: 'Боковая кнопка «Вперёд»',
      x: -0.12,
      y: 1.55,
      w: 0.24,
      h: 0.7,
      kind: 'side',
      match: { button: 4 },
    },
    {
      code: 'Mouse4',
      short: 'M4',
      label: 'Боковая кнопка «Назад»',
      x: -0.12,
      y: 2.35,
      w: 0.24,
      h: 0.75,
      kind: 'side',
      match: { button: 3 },
    },
  ],
}

export default mouse2Side
