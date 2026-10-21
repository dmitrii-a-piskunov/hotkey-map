/**
 * Раскладка клавиатуры AULA F75: 75% ANSI, 80 клавиш, регулятор и индикатор.
 *
 * Координаты и размеры — в юнитах (1u = шаг обычной клавиши).
 * Компонент клавиатуры умножает их на размер юнита в пикселях.
 *
 * Позиции сняты с фото клавиатуры пользователя (вид сверху):
 * - ряд F отделён от цифрового зазором 0.4u, группы F1–F4, F5–F8, F9–F12
 *   разнесены неравномерно, как на корпусе;
 * - справа от пробела только Fn и Ctrl по 1.25u, перед стрелками зазор 0.5u.
 *
 * Цвета и форма клавиш — в src/styles/device-theme.ts, здесь только геометрия
 * и подписи (ТЗ, NFR-11).
 */

export interface KeyLabel {
  /** Основная подпись на английской раскладке */
  en: string
  /** Подпись на русской раскладке (ЙЦУКЕН) */
  ru?: string
  /** Верхний символ с Shift на английской раскладке, например «!» над «1» */
  shift?: string
  /** Символ русской раскладки, если он отличается от основной подписи, например «№» на 3 */
  ruSymbol?: string
  /** Значок для модификаторов, рисуется перед подписью: ←, ⇧, ↵, ⇥ */
  icon?: string
}

export interface KeyDef {
  /** Физический код клавиши — значение KeyboardEvent.code */
  code: string
  label: KeyLabel
  /** Левый верхний угол, в юнитах */
  x: number
  y: number
  /** Размер, в юнитах */
  w: number
  h: number
  /** Ряд по профилю клавиш (Cherry: R1 — цифры, R4 — нижний), влияет на наклон в 3D */
  profileRow: 'F' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
  /** Можно ли назначать бинды на эту клавишу */
  assignable: boolean
  /**
   * Ловится ли нажатие браузером. false — бинд назначается только кликом
   * по экранной клавише (ТЗ, FR-03).
   */
  capturable: boolean
}

export interface KnobDef {
  /** Центр, в юнитах */
  cx: number
  cy: number
  /** Диаметр, в юнитах */
  d: number
}

export interface IndicatorDef {
  /** Полоска индикатора между Esc и F1, декоративная */
  x: number
  y: number
  w: number
  h: number
}

export interface KeyboardLayout {
  id: string
  name: string
  /** Габариты области клавиш, в юнитах (без корпуса) */
  width: number
  height: number
  keys: KeyDef[]
  knob?: KnobDef
  indicator?: IndicatorDef
}

const ROWS = {
  F: { y: 0, profile: 'F' },
  1: { y: 1.4, profile: 'R1' },
  2: { y: 2.4, profile: 'R2' },
  3: { y: 3.4, profile: 'R3' },
  4: { y: 4.4, profile: 'R4' },
  5: { y: 5.4, profile: 'R5' },
} as const
type Row = keyof typeof ROWS

interface KeyOptions {
  w?: number
  ru?: string
  shift?: string
  ruSymbol?: string
  icon?: string
  assignable?: boolean
  capturable?: boolean
}

function key(code: string, x: number, row: Row, en: string, options: KeyOptions = {}): KeyDef {
  const { w = 1, assignable = true, capturable = true, ...labels } = options
  const label: KeyLabel = { en }
  if (labels.ru) label.ru = labels.ru
  if (labels.shift) label.shift = labels.shift
  if (labels.ruSymbol) label.ruSymbol = labels.ruSymbol
  if (labels.icon) label.icon = labels.icon
  return {
    code,
    label,
    x,
    y: ROWS[row].y,
    w,
    h: 1,
    profileRow: ROWS[row].profile,
    assignable,
    capturable,
  }
}

type RunItem = [code: string, en: string, options?: KeyOptions]

/** Клавиши по 1u подряд, начиная с x */
function run(row: Row, startX: number, items: RunItem[]): KeyDef[] {
  return items.map(([code, en, options], i) => key(code, startX + i, row, en, options))
}

const keys: KeyDef[] = [
  // Ряд F: Esc, индикатор, три группы F-клавиш
  key('Escape', 0, 'F', 'Esc'),
  ...run('F', 2, [
    ['F1', 'F1'],
    ['F2', 'F2'],
    ['F3', 'F3'],
    ['F4', 'F4'],
  ]),
  ...run('F', 6.3, [
    ['F5', 'F5'],
    ['F6', 'F6'],
    ['F7', 'F7'],
    ['F8', 'F8'],
  ]),
  ...run('F', 10.6, [
    ['F9', 'F9'],
    ['F10', 'F10'],
    ['F11', 'F11'],
    ['F12', 'F12'],
  ]),

  // Ряд 1: цифры
  ...run(1, 0, [
    ['Backquote', '`', { shift: '~', ru: 'Ё' }],
    ['Digit1', '1', { shift: '!' }],
    ['Digit2', '2', { shift: '@', ruSymbol: '"' }],
    ['Digit3', '3', { shift: '#', ruSymbol: '№' }],
    ['Digit4', '4', { shift: '$', ruSymbol: ';' }],
    ['Digit5', '5', { shift: '%' }],
    ['Digit6', '6', { shift: '^', ruSymbol: ':' }],
    ['Digit7', '7', { shift: '&', ruSymbol: '?' }],
    ['Digit8', '8', { shift: '*' }],
    ['Digit9', '9', { shift: '(' }],
    ['Digit0', '0', { shift: ')' }],
    ['Minus', '-', { shift: '_' }],
    ['Equal', '=', { shift: '+' }],
  ]),
  key('Backspace', 13, 1, 'Backspace', { w: 2, icon: '←' }),
  key('Delete', 15, 1, 'Delete'),

  // Ряд 2: QWERTY
  key('Tab', 0, 2, 'Tab', { w: 1.5, icon: '⇥' }),
  ...run(2, 1.5, [
    ['KeyQ', 'Q', { ru: 'Й' }],
    ['KeyW', 'W', { ru: 'Ц' }],
    ['KeyE', 'E', { ru: 'У' }],
    ['KeyR', 'R', { ru: 'К' }],
    ['KeyT', 'T', { ru: 'Е' }],
    ['KeyY', 'Y', { ru: 'Н' }],
    ['KeyU', 'U', { ru: 'Г' }],
    ['KeyI', 'I', { ru: 'Ш' }],
    ['KeyO', 'O', { ru: 'Щ' }],
    ['KeyP', 'P', { ru: 'З' }],
    ['BracketLeft', '[', { shift: '{', ru: 'Х' }],
    ['BracketRight', ']', { shift: '}', ru: 'Ъ' }],
  ]),
  key('Backslash', 13.5, 2, '\\', { w: 1.5, shift: '|', ruSymbol: '/' }),
  key('PageUp', 15, 2, 'PgUp'),

  // Ряд 3: ASDF
  key('CapsLock', 0, 3, 'Caps Lock', { w: 1.75 }),
  ...run(3, 1.75, [
    ['KeyA', 'A', { ru: 'Ф' }],
    ['KeyS', 'S', { ru: 'Ы' }],
    ['KeyD', 'D', { ru: 'В' }],
    ['KeyF', 'F', { ru: 'А' }],
    ['KeyG', 'G', { ru: 'П' }],
    ['KeyH', 'H', { ru: 'Р' }],
    ['KeyJ', 'J', { ru: 'О' }],
    ['KeyK', 'K', { ru: 'Л' }],
    ['KeyL', 'L', { ru: 'Д' }],
    ['Semicolon', ';', { shift: ':', ru: 'Ж' }],
    ['Quote', "'", { shift: '"', ru: 'Э' }],
  ]),
  key('Enter', 12.75, 3, 'Enter', { w: 2.25, icon: '↵' }),
  key('PageDown', 15, 3, 'PgDn'),

  // Ряд 4: ZXCV
  key('ShiftLeft', 0, 4, 'Shift', { w: 2.25, icon: '⇧' }),
  ...run(4, 2.25, [
    ['KeyZ', 'Z', { ru: 'Я' }],
    ['KeyX', 'X', { ru: 'Ч' }],
    ['KeyC', 'C', { ru: 'С' }],
    ['KeyV', 'V', { ru: 'М' }],
    ['KeyB', 'B', { ru: 'И' }],
    ['KeyN', 'N', { ru: 'Т' }],
    ['KeyM', 'M', { ru: 'Ь' }],
    ['Comma', ',', { shift: '<', ru: 'Б' }],
    ['Period', '.', { shift: '>', ru: 'Ю' }],
    ['Slash', '/', { shift: '?', ru: '.' }],
  ]),
  key('ShiftRight', 12.25, 4, 'Shift', { w: 1.75, icon: '⇧' }),
  key('ArrowUp', 14, 4, '↑'),
  key('End', 15, 4, 'End'),

  // Ряд 5: нижний. Справа от пробела только Fn и Ctrl, затем зазор
  key('ControlLeft', 0, 5, 'Ctrl', { w: 1.25 }),
  // Win забирает Windows: в играх на неё не назначают
  key('MetaLeft', 1.25, 5, 'Win', { w: 1.25, assignable: false, capturable: false }),
  key('AltLeft', 2.5, 5, 'Alt', { w: 1.25 }),
  key('Space', 3.75, 5, '', { w: 6.25 }),
  // Fn обрабатывается прошивкой клавиатуры, игры и браузер его не видят
  key('Fn', 10, 5, 'Fn', { w: 1.25, assignable: false, capturable: false }),
  key('ControlRight', 11.25, 5, 'Ctrl', { w: 1.25 }),
  key('ArrowLeft', 13, 5, '←'),
  key('ArrowDown', 14, 5, '↓'),
  key('ArrowRight', 15, 5, '→'),
]

export const aulaF75: KeyboardLayout = {
  id: 'aula-f75',
  name: 'AULA F75',
  width: 16,
  height: 6.4,
  keys,
  knob: { cx: 15.5, cy: 0.5, d: 0.96 },
  indicator: { x: 1.5, y: 0.1, w: 0.08, h: 0.8 },
}

export default aulaF75
