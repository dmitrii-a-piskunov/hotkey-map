import type { CSSProperties } from 'react'
import type { LabelLang } from '@/domain/input'
import type { KeyDef } from '@/layouts/aula-f75'
import { deviceTheme } from '@/styles/device-theme'

const { legend, state } = deviceTheme

// Размеры в em: у контейнера подписей font-size равен юниту.
// Отступ задаёт рамка, а не сами подписи: у них свой font-size.
const BOX: CSSProperties = { inset: `${legend.padding}em` }

const MAIN: CSSProperties = { fontSize: `${legend.sizeMain}em`, fontWeight: legend.weightMain }
const RU: CSSProperties = { fontSize: `${legend.sizeRu}em`, fontWeight: legend.weightRu }
const SHIFT: CSSProperties = { fontSize: `${legend.sizeShift}em`, fontWeight: legend.weightMain }
/** Символ русской раскладки на цифрах — размером с верхний символ */
const RU_SYMBOL: CSSProperties = { ...RU, fontSize: SHIFT.fontSize }
const MOD: CSSProperties = { fontSize: `${legend.sizeMod}em`, fontWeight: legend.weightMod }

const TOP_LEFT: CSSProperties = { top: 0, left: 0 }
const BOTTOM_LEFT: CSSProperties = { bottom: 0, left: 0 }
const BOTTOM_RIGHT: CSSProperties = { bottom: 0, right: 0 }

function Legend({
  style,
  dim,
  children,
}: {
  style: CSSProperties
  dim?: boolean
  children: string
}) {
  return (
    <span className="legend" style={dim ? { ...style, opacity: state.dimOpacity } : style}>
      {children}
    </span>
  )
}

/**
 * Подписи как на превью: буквы, цифры с символами, модификаторы.
 * FR-04: в режиме EN русские подписи серые (legendRu), в режиме RU они
 * получают цвет основной подписи, а английские бледнеют.
 */
export function KeyLabels({ keyDef, labelLang }: { keyDef: KeyDef; labelLang: LabelLang }) {
  return (
    <span className="legend-box" style={BOX}>
      <Labels keyDef={keyDef} labelLang={labelLang} />
    </span>
  )
}

function Labels({ keyDef, labelLang }: { keyDef: KeyDef; labelLang: LabelLang }) {
  const { en, ru: ruLabel, shift, ruSymbol, icon } = keyDef.label
  const right = ruLabel ?? ruSymbol
  const dimEn = right !== undefined && labelLang === 'ru'
  const ruColor: CSSProperties = {
    color: labelLang === 'ru' ? 'var(--legend)' : 'var(--legend-ru)',
  }

  if (shift) {
    return (
      <>
        <Legend style={{ ...SHIFT, ...TOP_LEFT }} dim={dimEn}>
          {shift}
        </Legend>
        <Legend style={{ ...SHIFT, ...BOTTOM_LEFT }} dim={dimEn}>
          {en}
        </Legend>
        {right && (
          <Legend style={{ ...(ruLabel ? RU : RU_SYMBOL), ...ruColor, ...BOTTOM_RIGHT }}>
            {right}
          </Legend>
        )}
      </>
    )
  }
  if (ruLabel) {
    return (
      <>
        <Legend style={{ ...MAIN, ...TOP_LEFT }} dim={dimEn}>
          {en}
        </Legend>
        <Legend style={{ ...RU, ...ruColor, ...BOTTOM_RIGHT }}>{ruLabel}</Legend>
      </>
    )
  }
  if (!en) return null
  // Стрелки — один символ по центру
  if (en.length === 1 && !icon) {
    return (
      <span className="legend legend-center" style={MAIN}>
        {en}
      </span>
    )
  }
  return (
    <span className="legend legend-mod" style={{ ...MOD, left: 0 }}>
      {icon ? `${icon} ${en}` : en}
    </span>
  )
}
