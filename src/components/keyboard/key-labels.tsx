import type { CSSProperties } from 'react'
import type { LabelMode } from '@/domain/input'
import type { KeyDef } from '@/layouts/aula-f75'
import { deviceTheme } from '@/styles/device-theme'

const { legend } = deviceTheme

// Размеры в em: у контейнера подписей font-size равен юниту.
// Отступ задаёт рамка, а не сами подписи: у них свой font-size.
const BOX: CSSProperties = { inset: `${legend.padding}em` }

const MAIN: CSSProperties = { fontSize: `${legend.sizeMain}em`, fontWeight: legend.weightMain }
const RU: CSSProperties = {
  fontSize: `${legend.sizeRu}em`,
  fontWeight: legend.weightRu,
  color: 'var(--legend-ru)',
}
const SHIFT: CSSProperties = { fontSize: `${legend.sizeShift}em`, fontWeight: legend.weightMain }
/** Символ русской раскладки на цифрах — размером с верхний символ */
const RU_SYMBOL: CSSProperties = { ...RU, fontSize: SHIFT.fontSize }
const MOD: CSSProperties = { fontSize: `${legend.sizeMod}em`, fontWeight: legend.weightMod }
/** Значок модификатора: размер относительно слова, чтобы стоять с ним в одной строке */
const ICON: CSSProperties = { fontSize: `${legend.sizeIcon / legend.sizeMod}em` }
const ARROW: CSSProperties = { fontSize: `${legend.sizeArrow}em`, fontWeight: legend.weightMain }
const SINGLE: CSSProperties = { fontSize: `${legend.sizeSingle}em`, fontWeight: legend.weightMain }

const TOP_LEFT: CSSProperties = { top: 0, left: 0 }
const BOTTOM_LEFT: CSSProperties = { bottom: 0, left: 0 }
const BOTTOM_RIGHT: CSSProperties = { bottom: 0, right: 0 }

function Legend({ style, children }: { style: CSSProperties; children: string }) {
  return (
    <span className="legend" style={style}>
      {children}
    </span>
  )
}

/**
 * Знак клавиши в режимах EN и RU — то, что игра покажет в настройках.
 * Есть у букв, цифр и клавиш-символов; у модификаторов, F-клавиш и стрелок
 * нет — они всегда в привычном виде. Без верхних символов Shift.
 */
function singleLegend(keyDef: KeyDef, lang: 'en' | 'ru'): string | null {
  const { en, ru, shift } = keyDef.label
  if (ru === undefined && shift === undefined) return null
  return lang === 'ru' ? (ru ?? en) : en
}

/** Подписи как на настоящей клавиатуре: обе раскладки, верхние символы, значки */
function RealisticLabels({ keyDef }: { keyDef: KeyDef }) {
  const { en, ru: ruLabel, shift, ruSymbol, icon } = keyDef.label
  const right = ruLabel ?? ruSymbol

  if (shift) {
    return (
      <>
        <Legend style={{ ...SHIFT, ...TOP_LEFT }}>{shift}</Legend>
        <Legend style={{ ...SHIFT, ...BOTTOM_LEFT }}>{en}</Legend>
        {right && (
          <Legend style={{ ...(ruLabel ? RU : RU_SYMBOL), ...BOTTOM_RIGHT }}>{right}</Legend>
        )}
      </>
    )
  }
  if (ruLabel) {
    return (
      <>
        <Legend style={{ ...MAIN, ...TOP_LEFT }}>{en}</Legend>
        <Legend style={{ ...RU, ...BOTTOM_RIGHT }}>{ruLabel}</Legend>
      </>
    )
  }
  if (!en) return null
  // Стрелки — один символ по центру
  if (en.length === 1 && !icon) {
    return (
      <span className="legend legend-center" style={ARROW}>
        {en}
      </span>
    )
  }
  return (
    <span className="legend legend-mod" style={{ ...MOD, left: 0 }}>
      {icon && <span style={ICON}>{icon}</span>}
      {icon ? ` ${en}` : en}
    </span>
  )
}

/**
 * Подписи клавиши по режиму (FR-04): EN/RU — как на настоящей клавиатуре;
 * EN и RU — буквы, цифры и символы одним знаком по центру, остальное как обычно.
 */
export function KeyLabels({ keyDef, labelLang }: { keyDef: KeyDef; labelLang: LabelMode }) {
  const single = labelLang === 'enru' ? null : singleLegend(keyDef, labelLang)
  return (
    <span className="legend-box" style={BOX}>
      {single !== null ? (
        <span className="legend legend-center" style={SINGLE}>
          {single}
        </span>
      ) : (
        <RealisticLabels keyDef={keyDef} />
      )}
    </span>
  )
}
