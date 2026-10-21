/**
 * Раскладка мыши: две основные кнопки, колесо и две боковые кнопки.
 *
 * Координаты — в юнитах внутри прямоугольника мыши (ширина 3, высота 5),
 * так же как у клавиатуры. Компонент рисует корпус мыши и кладёт зоны
 * входов поверх него.
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

export const mouse2Side: MouseLayout = {
  id: 'mouse-2-side',
  name: 'Мышь с двумя боковыми кнопками',
  width: 3,
  height: 5,
  inputs: [
    {
      code: 'MouseLeft',
      short: 'ЛКМ',
      label: 'Левая кнопка мыши',
      x: 0,
      y: 0,
      w: 1.25,
      h: 2,
      kind: 'button',
      match: { button: 0 },
    },
    {
      code: 'MouseRight',
      short: 'ПКМ',
      label: 'Правая кнопка мыши',
      x: 1.75,
      y: 0,
      w: 1.25,
      h: 2,
      kind: 'button',
      match: { button: 2 },
    },
    {
      code: 'WheelUp',
      short: '▲',
      label: 'Колесо вверх',
      x: 1.25,
      y: 0.1,
      w: 0.5,
      h: 0.4,
      kind: 'scroll',
      match: { wheel: 'up' },
    },
    {
      code: 'MouseMiddle',
      short: 'СКМ',
      label: 'Нажатие колеса',
      x: 1.25,
      y: 0.55,
      w: 0.5,
      h: 0.9,
      kind: 'wheel',
      match: { button: 1 },
    },
    {
      code: 'WheelDown',
      short: '▼',
      label: 'Колесо вниз',
      x: 1.25,
      y: 1.5,
      w: 0.5,
      h: 0.4,
      kind: 'scroll',
      match: { wheel: 'down' },
    },
    {
      code: 'Mouse5',
      short: 'M5',
      label: 'Боковая кнопка «Вперёд»',
      x: -0.2,
      y: 2.2,
      w: 0.35,
      h: 0.7,
      kind: 'side',
      match: { button: 4 },
    },
    {
      code: 'Mouse4',
      short: 'M4',
      label: 'Боковая кнопка «Назад»',
      x: -0.2,
      y: 3.0,
      w: 0.35,
      h: 0.7,
      kind: 'side',
      match: { button: 3 },
    },
  ],
}

export default mouse2Side
