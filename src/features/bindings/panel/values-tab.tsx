import { RotateCcw, Settings2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Segmented } from '@/components/common/segmented'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { LIMITS } from '@/domain/names'
import { fitSliderValue, isDefaultValue, settingValueOf } from '@/domain/setting-values'
import { settingSections, type ValueSettingDef } from '@/domain/settings-template'
import type { Game, Profile, SettingDef, SettingValue } from '@/domain/types'
import { openEditor } from '@/features/games/ui-store'
import { ru } from '@/i18n/ru'
import { fill, formatDecimal, parseDecimal } from '@/lib/format'
import { resetSettingValueCmd, setSettingValueCmd } from '../commands'

const t = ru.values
type SliderDef = Extract<SettingDef, { type: 'slider' }>

/** Значение для показа рядом с кнопкой сброса */
function shown(def: ValueSettingDef, value: SettingValue): string {
  switch (def.type) {
    case 'slider':
      return `${formatDecimal(value as number)}${def.unit ? ` ${def.unit}` : ''}`
    case 'toggle':
      return value ? t.on : t.off
    case 'select':
      return def.options.find((o) => o.id === value)?.name ?? ''
    case 'text':
      return String(value)
  }
}

/**
 * Ползунок и поле точного значения (FR-18): синхронизированы в обе
 * стороны. Число вне диапазона в поле приводится к границе с подсказкой,
 * не число — к прежнему значению.
 */
function SliderValue({ def, value, labelId }: { def: SliderDef; value: number; labelId: string }) {
  // Пока тянут ползунок, значение живёт локально — в данные идёт отпускание
  const [dragging, setDragging] = useState<number | null>(null)
  // Текст, пока его набирают; иначе поле показывает значение
  const [typed, setTyped] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const current = dragging ?? value
  const text = typed ?? formatDecimal(current)

  function commitText() {
    if (typed === null) return
    setTyped(null)
    const n = parseDecimal(typed)
    if (n === null) {
      setHint(t.notNumber)
      return
    }
    const fit = fitSliderValue(def, n)
    setHint(
      fit.clamped
        ? fill(t.range, { min: formatDecimal(def.min), max: formatDecimal(def.max) })
        : null,
    )
    setSettingValueCmd(def.id, fit.value)
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Slider
          aria-labelledby={labelId}
          min={def.min}
          max={def.max}
          step={def.step}
          value={[current]}
          onValueChange={([v]) => {
            if (v !== undefined) setDragging(v)
            setHint(null)
          }}
          onValueCommit={([v]) => {
            setDragging(null)
            if (v !== undefined) setSettingValueCmd(def.id, v)
          }}
        />
        <Input
          aria-labelledby={labelId}
          inputMode="decimal"
          className="h-8 w-20 shrink-0 text-right tabular-nums"
          value={text}
          onChange={(e) => {
            setTyped(e.target.value)
          }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText()
          }}
        />
        {def.unit && <span className="shrink-0 text-xs text-muted-foreground">{def.unit}</span>}
      </div>
      {hint && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Текст сохраняется при уходе из поля */
function TextValue({ def, value, labelId }: { def: SettingDef; value: string; labelId: string }) {
  const [typed, setTyped] = useState<string | null>(null)
  return (
    <Input
      aria-labelledby={labelId}
      className="h-8"
      maxLength={LIMITS.text}
      value={typed ?? value}
      onChange={(e) => {
        setTyped(e.target.value)
      }}
      onBlur={() => {
        if (typed !== null) setSettingValueCmd(def.id, typed)
        setTyped(null)
      }}
    />
  )
}

/** Пояснение на месте картинки из меню игры */
function InfoBlock({ def }: { def: Extract<SettingDef, { type: 'info' }> }) {
  return (
    <div
      className="mx-2 my-1.5 flex items-center rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
      style={{ minHeight: `${(def.height ?? 3) * 1.25}rem` }}
    >
      {def.text}
    </div>
  )
}

function SettingRow({ def, profile }: { def: ValueSettingDef; profile: Profile }) {
  const labelId = useId()
  const value = settingValueOf(def, profile)
  const custom = !isDefaultValue(def, profile)

  return (
    <div className="grid gap-1.5 px-2 py-1.5" data-setting-id={def.id}>
      <div className="flex items-center gap-2">
        <span id={labelId} className="min-w-0 flex-1 truncate text-sm" title={def.name}>
          {def.name}
        </span>
        {custom && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            aria-label={fill(t.reset, { value: shown(def, def.defaultValue) })}
            title={fill(t.reset, { value: shown(def, def.defaultValue) })}
            onClick={() => {
              resetSettingValueCmd(def.id)
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>
      {def.type === 'slider' && (
        <SliderValue key={profile.id} def={def} value={value as number} labelId={labelId} />
      )}
      {def.type === 'toggle' && (
        <Segmented
          label={def.name}
          value={value ? 'on' : 'off'}
          options={[
            { value: 'on', label: t.on },
            { value: 'off', label: t.off },
          ]}
          onChange={(v) => {
            setSettingValueCmd(def.id, v === 'on')
          }}
        />
      )}
      {def.type === 'select' && (
        <NativeSelect
          aria-labelledby={labelId}
          className="h-8"
          value={String(value)}
          onChange={(e) => {
            setSettingValueCmd(def.id, e.target.value)
          }}
        >
          {def.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {def.type === 'text' && (
        <TextValue key={profile.id} def={def} value={String(value)} labelId={labelId} />
      )}
    </div>
  )
}

/** Вкладка «Настройки» (FR-18): значения шаблона настроек в текущем профиле */
export function ValuesTab({ game, profile }: { game: Game; profile: Profile }) {
  const sections = settingSections(game)
  if (sections.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            openEditor(game.id, 'settings')
          }}
        >
          <Settings2 />
          {t.editTemplate}
        </Button>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      {sections.map((s) => (
        <section key={s.group} aria-label={s.group}>
          <h3 className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase">
            {s.group}
          </h3>
          {s.settings.map((def) =>
            def.type === 'info' ? (
              <InfoBlock key={def.id} def={def} />
            ) : (
              <SettingRow key={def.id} def={def} profile={profile} />
            ),
          )}
        </section>
      ))}
    </div>
  )
}
