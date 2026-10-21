/**
 * Раскладка клавиатуры AULA F75: 75% ANSI, 81 клавиша и регулятор.
 *
 * Координаты и размеры — в юнитах (1u = ширина обычной клавиши).
 * Компонент клавиатуры умножает их на размер юнита в пикселях.
 * Ряд F-клавиш отделён от основного блока зазором 0.25u.
 *
 * Пропорции стандартные для 75%. Зазоры в ряду F и положение регулятора
 * подобраны по фото модели — при необходимости поправить здесь,
 * компоненты менять не нужно (ТЗ, NFR-11).
 */

export interface KeyLabel {
  /** Подпись на английской раскладке */
  en: string
  /** Подпись на русской раскладке (ЙЦУКЕН). Нет — совпадает с en */
  ru?: string
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
  /** Можно ли назначать бинды на эту клавишу */
  assignable: boolean
  /**
   * Ловится ли нажатие браузером. false — бинд назначается только кликом
   * по экранной клавише (ТЗ, FR-03).
   */
  capturable: boolean
}

export interface KnobDef {
  /** Центр регулятора, в юнитах */
  cx: number
  cy: number
  /** Диаметр, в юнитах */
  d: number
}

export interface KeyboardLayout {
  id: string
  name: string
  /** Габариты раскладки, в юнитах */
  width: number
  height: number
  keys: KeyDef[]
  /** Декоративный регулятор, не назначается */
  knob?: KnobDef
}

/** Вертикальные позиции рядов */
const ROW_Y = [0, 1.25, 2.25, 3.25, 4.25, 5.25] as const
type Row = 0 | 1 | 2 | 3 | 4 | 5

function key(
  code: string,
  x: number,
  row: Row,
  en: string,
  options: { ru?: string; w?: number; assignable?: boolean; capturable?: boolean } = {},
): KeyDef {
  return {
    code,
    label: options.ru ? { en, ru: options.ru } : { en },
    x,
    y: ROW_Y[row],
    w: options.w ?? 1,
    h: 1,
    assignable: options.assignable ?? true,
    capturable: options.capturable ?? true,
  }
}

/** Ряд одинаковых клавиш по 1u подряд, начиная с x */
function run(row: Row, startX: number, items: [code: string, en: string, ru?: string][]): KeyDef[] {
  return items.map(([code, en, ru], i) => key(code, startX + i, row, en, { ru }))
}

const keys: KeyDef[] = [
  // Ряд 1: Esc и F-клавиши группами по 4, зазоры 0.5u
  key('Escape', 0, 0, 'Esc'),
  ...run(0, 1.5, [
    ['F1', 'F1'],
    ['F2', 'F2'],
    ['F3', 'F3'],
    ['F4', 'F4'],
  ]),
  ...run(0, 6, [
    ['F5', 'F5'],
    ['F6', 'F6'],
    ['F7', 'F7'],
    ['F8', 'F8'],
  ]),
  ...run(0, 10.5, [
    ['F9', 'F9'],
    ['F10', 'F10'],
    ['F11', 'F11'],
    ['F12', 'F12'],
  ]),

  // Ряд 2: цифры
  ...run(1, 0, [
    ['Backquote', '`', 'Ё'],
    ['Digit1', '1'],
    ['Digit2', '2'],
    ['Digit3', '3'],
    ['Digit4', '4'],
    ['Digit5', '5'],
    ['Digit6', '6'],
    ['Digit7', '7'],
    ['Digit8', '8'],
    ['Digit9', '9'],
    ['Digit0', '0'],
    ['Minus', '-'],
    ['Equal', '='],
  ]),
  key('Backspace', 13, 1, 'Backspace', { w: 2 }),
  key('Delete', 15, 1, 'Del'),

  // Ряд 3: QWERTY
  key('Tab', 0, 2, 'Tab', { w: 1.5 }),
  ...run(2, 1.5, [
    ['KeyQ', 'Q', 'Й'],
    ['KeyW', 'W', 'Ц'],
    ['KeyE', 'E', 'У'],
    ['KeyR', 'R', 'К'],
    ['KeyT', 'T', 'Е'],
    ['KeyY', 'Y', 'Н'],
    ['KeyU', 'U', 'Г'],
    ['KeyI', 'I', 'Ш'],
    ['KeyO', 'O', 'Щ'],
    ['KeyP', 'P', 'З'],
    ['BracketLeft', '[', 'Х'],
    ['BracketRight', ']', 'Ъ'],
  ]),
  key('Backslash', 13.5, 2, '\\', { w: 1.5 }),
  key('PageUp', 15, 2, 'PgUp'),

  // Ряд 4: ASDF
  key('CapsLock', 0, 3, 'Caps', { w: 1.75 }),
  ...run(3, 1.75, [
    ['KeyA', 'A', 'Ф'],
    ['KeyS', 'S', 'Ы'],
    ['KeyD', 'D', 'В'],
    ['KeyF', 'F', 'А'],
    ['KeyG', 'G', 'П'],
    ['KeyH', 'H', 'Р'],
    ['KeyJ', 'J', 'О'],
    ['KeyK', 'K', 'Л'],
    ['KeyL', 'L', 'Д'],
    ['Semicolon', ';', 'Ж'],
    ['Quote', "'", 'Э'],
  ]),
  key('Enter', 12.75, 3, 'Enter', { w: 2.25 }),
  key('PageDown', 15, 3, 'PgDn'),

  // Ряд 5: ZXCV
  key('ShiftLeft', 0, 4, 'Shift', { w: 2.25 }),
  ...run(4, 2.25, [
    ['KeyZ', 'Z', 'Я'],
    ['KeyX', 'X', 'Ч'],
    ['KeyC', 'C', 'С'],
    ['KeyV', 'V', 'М'],
    ['KeyB', 'B', 'И'],
    ['KeyN', 'N', 'Т'],
    ['KeyM', 'M', 'Ь'],
    ['Comma', ',', 'Б'],
    ['Period', '.', 'Ю'],
    ['Slash', '/', '.'],
  ]),
  key('ShiftRight', 12.25, 4, 'Shift', { w: 1.75 }),
  key('ArrowUp', 14, 4, '↑'),
  key('End', 15, 4, 'End'),

  // Ряд 6: нижний
  key('ControlLeft', 0, 5, 'Ctrl', { w: 1.25 }),
  // Win браузер не перехватывает: бинд только кликом
  key('MetaLeft', 1.25, 5, 'Win', { w: 1.25, capturable: false }),
  key('AltLeft', 2.5, 5, 'Alt', { w: 1.25 }),
  key('Space', 3.75, 5, 'Space', { w: 6.25 }),
  key('AltRight', 10, 5, 'Alt'),
  // Fn обрабатывается прошивкой клавиатуры, игры и браузер его не видят
  key('Fn', 11, 5, 'Fn', { assignable: false, capturable: false }),
  key('ControlRight', 12, 5, 'Ctrl'),
  key('ArrowLeft', 13, 5, '←'),
  key('ArrowDown', 14, 5, '↓'),
  key('ArrowRight', 15, 5, '→'),
]

export const aulaF75: KeyboardLayout = {
  id: 'aula-f75',
  name: 'AULA F75',
  width: 16,
  height: 6.25,
  keys,
  knob: { cx: 15.5, cy: 0.5, d: 0.9 },
}

export default aulaF75
