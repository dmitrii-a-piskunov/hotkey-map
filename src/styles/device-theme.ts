/**
 * Тема устройств: цвета, форма клавиш и параметры 3D для клавиатуры и мыши.
 *
 * Цвета сняты с фото клавиатуры пользователя и приведены к экранной яркости
 * (фото пересвечено окном). Геометрия раскладки — в src/layouts.
 *
 * Все размеры — в юнитах (u), как в раскладке. Компонент умножает их на unitPx.
 * Цвета устройств одинаковы в светлой и тёмной теме приложения: это цвета
 * физической клавиатуры. От темы зависят только фон сцены и тень.
 */

export type CapStyle = 'alpha' | 'mod' | 'accent'

export interface CapColors {
  /** Верхняя грань */
  top: string
  /** Боковые и передняя грани (в 2D — нижняя кромка) */
  side: string
  /** Английская подпись и верхние символы */
  legend: string
  /** Русская подпись */
  legendRu: string
}

export const deviceTheme = {
  /** Размер юнита по умолчанию; компонент пересчитывает его под ширину окна */
  unitPx: 56,

  case: {
    color: '#2a2a2c',
    /** Тёмная кромка по контуру и внутренний колодец под клавишами */
    edge: '#1b1b1d',
    well: '#141416',
    /** Скругление углов корпуса */
    radius: 0.3,
    /** Поля корпуса вокруг клавиш */
    bezel: { top: 0.4, right: 0.3, bottom: 0.45, left: 0.3 },
    /** Высота корпуса в 3D — видна спереди */
    height3d: 0.45,
  },

  caps: {
    alpha: { top: '#2c3446', side: '#202736', legend: '#f2a93b', legendRu: '#959ca8' },
    mod: { top: '#2b2c2f', side: '#1e1f21', legend: '#f2a93b', legendRu: '#959ca8' },
    accent: { top: '#f1bd5f', side: '#d4a148', legend: '#232325', legendRu: '#5b4a2a' },
  } satisfies Record<CapStyle, CapColors>,

  /** Какие клавиши какого цвета; всё, что не перечислено, — alpha */
  capStyleByCode: {
    accent: ['Escape', 'Enter', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
    mod: [
      'F5',
      'F6',
      'F7',
      'F8',
      'Backspace',
      'Delete',
      'Tab',
      'CapsLock',
      'PageUp',
      'PageDown',
      'End',
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'MetaLeft',
      'AltLeft',
      'Fn',
      'ControlRight',
    ],
  } satisfies Partial<Record<CapStyle, string[]>>,

  cap: {
    /** Зазор между соседними клавишами */
    gap: 0.06,
    /** Скругление основания */
    radius: 0.08,
    /** Отступ верхней грани от основания: по бокам, сверху и снизу (снизу больше — видна передняя грань) */
    topInset: { side: 0.09, top: 0.05, bottom: 0.16 },
    topRadius: 0.07,
  },

  legend: {
    font: "'Inter', 'Segoe UI', system-ui, sans-serif",
    /** Буквы: английская сверху слева, русская снизу справа */
    sizeMain: 0.3,
    sizeRu: 0.28,
    /** Цифровой ряд: верхний символ и цифра слева, русский символ справа */
    sizeShift: 0.24,
    /** Модификаторы: значок и слово, слева по центру по высоте */
    sizeMod: 0.19,
    /** Значки ← ⇥ ⇧ ↵ на Backspace, Tab, Shift, Enter — чуть крупнее слова */
    sizeIcon: 0.3,
    /** Стрелки на клавишах-стрелках */
    sizeArrow: 0.34,
    weightMain: 700,
    weightRu: 500,
    weightMod: 700,
    padding: 0.1,
  },

  /**
   * Регулятор стоит в ряду F над колонкой Delete, крышка — размером с верхнюю
   * грань клавиши. В 3D — невысокий цилиндр: его верх на уровне верха клавиш
   * (view3d.capHeight × capShape3d.lift) и сдвинут наружу по той же перспективе.
   */
  knob: { cap: '#2a2d2e', ring: '#b9bcbf', ringWidth: 0.08, side: '#8d9094', sideDark: '#4a4c4f' },
  indicator: { color: '#8fa3c8' },

  /** Состояния (ТЗ, FR-01): выделение и конфликт — обводкой поверх цвета клавиши */
  state: {
    selected: { color: '#38bdf8', width: 0.06 },
    conflict: { color: '#ef4444', width: 0.06 },
    /** Приглушение в чужом слое и при поиске */
    dimOpacity: 0.35,
    /** Непригодные клавиши (Fn, регулятор) */
    disabledOpacity: 0.55,
  },

  view3d: {
    perspectivePx: 1400,
    /** Наклон всей клавиатуры */
    rotateX: 32,
    /** Высота клавиши над пластиной */
    capHeight: 0.5,
    /** Насколько клавиша проседает при нажатии и за сколько */
    pressDepth: 0.16,
    pressMs: 100,
    /**
     * Свет сверху: верхняя грань клавиши чуть светлее у дальнего края,
     * передняя грань темнеет к низу. Множители яркости цвета клавиши.
     */
    keyLighting: { topFar: 1.08, topNear: 0.97, frontTop: 0.92, frontBottom: 0.74, sides: 0.8 },
    /**
     * Форма кейкапа в 3D — усечённая пирамида: прямоугольное основание,
     * верхняя грань уже со всех сторон, четыре прямые грани-трапеции.
     * Скругление только у верхней грани и совсем малое у основания.
     */
    capShape3d: {
      topInsetSide: 0.12,
      topInsetTop: 0.04,
      topInsetBottom: 0.1,
      lift: 0.6,
      baseRadius: 0.02,
      topRadius: 0.05,
      /**
       * Перспектива по горизонтали: верхняя грань сдвигается наружу от центра
       * клавиатуры. У крайних клавиш внешняя боковая грань исчезает, видна
       * только внутренняя, обращённая к центру. 0 — без сдвига, 1 — внешняя
       * грань крайних клавиш полностью скрыта.
       */
      perspectiveShift: 0.95,
    },
    /**
     * Мышь наклоняется меньше клавиатуры, чтобы не укорачиваться, но с более
     * сильной перспективой — так перед сужается так же, как у клавиатуры.
     */
    mouseRotateX: 16,
    mousePerspectivePx: 600,
    /**
     * Наклон верхней грани по рядам профиля Cherry, в градусах.
     * Положительный — грань смотрит на пользователя.
     */
    profileTilt: { F: 8, R1: 6, R2: 3, R3: 0, R4: -3, R5: -5 },
  },

  /** Обобщённая игровая мышь в цветах пользователя */
  mouse: {
    /**
     * Силуэт для mouseOutline() / mouseOutlinePath() из src/layouts/mouse.ts:
     * сплюснутый полуэллипс спереди, прямые бока, полукруглая спинка.
     */
    shape: { frontDepth: 1.0, notch: 0.06, notchWidth: 0.6 },
    /** Колесо: ширина и длина видимой части, отступ от переднего края */
    wheelSize: { w: 0.36, h: 0.85, y: 0.42 },
    /** Линия раздела кнопок и корпуса — доля длины от переднего края */
    buttonSplit: 0.38,
    body: '#1f2022',
    edge: '#141516',
    /** Шов между кнопками и корпусом */
    seam: '#0d0d0e',
    wheel: '#8e9298',
    wheelTread: '#6c7076',
    side: '#3a3c40',
    height3d: 0.6,
    /**
     * Объём в 3D: корпус заливается радиальным градиентом от блика к краям,
     * по контуру — мягкое внутреннее затемнение. В SVG: radialGradient
     * для заливки и фильтр feGaussianBlur для обода. В 2D не используется.
     */
    shading: {
      /** Блик: центр в долях ширины и длины корпуса, радиус в долях длины */
      highlight: { color: '#73777e', x: 0.4, y: 0.48, radius: 0.42 },
      /** Цвет между бликом и краем */
      mid: '#2a2c30',
      /** Цвет у самого края */
      edge: '#08090a',
      /** Ширина внутреннего затемнения по контуру, в юнитах */
      rimWidth: 0.55,
      /** Блик на колесе и боковых кнопках */
      partHighlight: 'rgba(255, 255, 255, 0.35)',
    },
  },

  /** Фон сцены и тень зависят от темы приложения */
  scene: {
    light: { background: '#e9e6df', shadow: 'rgba(0, 0, 0, 0.28)' },
    dark: { background: '#16171a', shadow: 'rgba(0, 0, 0, 0.6)' },
  },
} as const

/** Стиль клавиши по её коду */
export function capStyleOf(code: string): CapStyle {
  const { accent, mod } = deviceTheme.capStyleByCode
  if ((accent as readonly string[]).includes(code)) return 'accent'
  if ((mod as readonly string[]).includes(code)) return 'mod'
  return 'alpha'
}

export default deviceTheme
