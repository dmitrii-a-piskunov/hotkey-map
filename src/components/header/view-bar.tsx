/**
 * Полоса вида под шапкой (раздел 8.2): режим ввода, язык подписей,
 * показ устройств, расцветка и 3D / 2D. Видна всегда, даже когда клавиатура
 * и мышь скрыты: иначе их нечем вернуть.
 */

import { Keyboard, Mouse } from 'lucide-react'
import type { ReactNode } from 'react'
import { Segmented } from '@/components/common/segmented'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LabelMode } from '@/domain/input'
import type { InputMode, ViewMode } from '@/domain/types'
import { useDataStore, useSettings } from '@/features/data/store'
import { useDevicesStore } from '@/features/devices/store'
import { ru } from '@/i18n/ru'
import { deviceTheme, type KeyboardColor } from '@/styles/device-theme'

// FR-03: «Навигация» первой — это режим по умолчанию
const INPUT_MODES = [
  { value: 'nav', label: ru.header.modeNav },
  { value: 'check', label: ru.header.modeCheck },
] as const satisfies readonly { value: InputMode; label: string }[]

// FR-04: EN/RU — как на настоящей клавиатуре; EN и RU — только нужное для биндов
const LABEL_MODES = [
  { value: 'enru', label: 'EN/RU' },
  { value: 'en', label: 'EN' },
  { value: 'ru', label: 'RU' },
] as const satisfies readonly { value: LabelMode; label: string }[]

const VIEWS = [
  { value: '3d', label: '3D' },
  { value: '2d', label: '2D' },
] as const satisfies readonly { value: ViewMode; label: string }[]

/** Образец расцветки: буквенная клавиша с оранжевой «A»; название — для экранного диктора */
function ColorSwatch({ color, name }: { color: KeyboardColor; name: string }) {
  const { top, legend } = deviceTheme.palettes[color].caps.alpha
  return (
    <>
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center rounded-[3px] text-[11px] leading-none font-bold"
        style={{ background: top, color: legend }}
      >
        A
      </span>
      <span className="sr-only">{name}</span>
    </>
  )
}

const KEYBOARD_COLORS = [
  {
    value: 'standard',
    label: <ColorSwatch color="standard" name={ru.header.keyboardColorStandard} />,
    title: ru.header.keyboardColorStandard,
  },
  {
    value: 'black',
    label: <ColorSwatch color="black" name={ru.header.keyboardColorBlack} />,
    title: ru.header.keyboardColorBlack,
  },
] as const satisfies readonly { value: KeyboardColor; label: ReactNode; title: string }[]

export function ViewBar() {
  const inputMode = useSettings((s) => s.inputMode)
  const labelLang = useSettings((s) => s.labelLang)
  const autoLang = useSettings((s) => s.autoLang)
  const view = useSettings((s) => s.view)
  const keyboardColor = useSettings((s) => s.keyboardColor)
  const showKeyboard = useSettings((s) => s.showKeyboard)
  const showMouse = useSettings((s) => s.showMouse)
  const updateSettings = useDataStore((s) => s.updateSettings)
  const releaseAll = useDevicesStore((s) => s.releaseAll)

  return (
    <div
      role="group"
      aria-label={ru.header.viewBar}
      className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-4 py-1.5"
    >
      <Segmented
        label={ru.header.inputMode}
        value={inputMode}
        options={INPUT_MODES}
        onChange={(mode) => {
          updateSettings({ inputMode: mode })
          releaseAll()
        }}
      />
      <div className="flex items-center gap-1">
        <Segmented
          label={ru.header.labelLang}
          value={labelLang}
          options={LABEL_MODES}
          onChange={(mode) => {
            updateSettings({ labelLang: mode })
          }}
        />
        {/* Автопереключение EN ↔ RU по последней клавише; в EN/RU не действует */}
        <ToggleGroup
          type="multiple"
          aria-label={ru.header.autoLang}
          value={autoLang ? ['auto'] : []}
          onValueChange={(next) => {
            updateSettings({ autoLang: next.includes('auto') })
          }}
        >
          <ToggleGroupItem value="auto" title={ru.header.autoLangHint}>
            {ru.header.autoLangShort}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {/* Показать или скрыть клавиатуру и мышь: скрыто всё — панель на весь экран */}
      <ToggleGroup
        type="multiple"
        aria-label={ru.header.devices}
        value={[showKeyboard && 'keyboard', showMouse && 'mouse'].filter((v) => v !== false)}
        onValueChange={(next) => {
          updateSettings({
            showKeyboard: next.includes('keyboard'),
            showMouse: next.includes('mouse'),
          })
        }}
      >
        <ToggleGroupItem value="keyboard" title={ru.header.showKeyboard}>
          <Keyboard />
        </ToggleGroupItem>
        <ToggleGroupItem value="mouse" title={ru.header.showMouse}>
          <Mouse />
        </ToggleGroupItem>
      </ToggleGroup>
      <Segmented
        label={ru.header.keyboardColor}
        value={keyboardColor}
        options={KEYBOARD_COLORS}
        onChange={(color) => {
          updateSettings({ keyboardColor: color })
        }}
      />
      <Segmented
        label={ru.header.view}
        value={view}
        options={VIEWS}
        onChange={(v) => {
          updateSettings({ view: v })
        }}
      />
    </div>
  )
}
