import { RotateCcw, Settings2 } from 'lucide-react'
import { useId, useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { columnLayout } from '@/domain/layout'
import { LIMITS } from '@/domain/names'
import { fitSliderValue, isDefaultValue, settingValueOf } from '@/domain/setting-values'
import { settingSections, type ValueSettingDef } from '@/domain/settings-template'
import type { Game, Profile, SettingDef, SettingValue } from '@/domain/types'
import { openEditor } from '@/features/games/ui-store'
import { ru } from '@/i18n/ru'
import { fill, formatDecimal, parseDecimal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { resetAllSettingValuesCmd, resetSettingValueCmd, setSettingValueCmd } from '../commands'

const t = ru.values
type SliderDef = Extract<SettingDef, { type: 'slider' }>

/** Значение для показа рядом с кнопкой сброса */
function shown(def: ValueSettingDef, value: SettingValue): string {
  switch (def.type) {
    case 'slider':
      return `${formatStep(value as number, def.step)}${def.unit ? ` ${def.unit}` : ''}`
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
  const text = typed ?? formatStep(current, def.step)

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

/** Число с точностью шага: 0,60 при шаге 0,01 — как в меню игры */
function formatStep(value: number, step: number): string {
  const digits = String(step).split('.')[1]?.length ?? 0
  return value.toFixed(digits).replace('.', ',')
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
        {def.type === 'toggle' ? (
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-sky-500"
              checked={value === true}
              onChange={(e) => {
                setSettingValueCmd(def.id, e.target.checked)
              }}
            />
            <span id={labelId} className="min-w-0 break-words">
              {def.name}
            </span>
          </label>
        ) : (
          <span id={labelId} className="min-w-0 flex-1 text-sm break-words">
            {def.name}
          </span>
        )}
        {/* Место под сброс есть всегда: появление кнопки не сдвигает строки */}
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-6 shrink-0 text-muted-foreground', !custom && 'invisible')}
          aria-hidden={!custom || undefined}
          tabIndex={custom ? undefined : -1}
          aria-label={fill(t.reset, { value: shown(def, def.defaultValue) })}
          title={fill(t.reset, { value: shown(def, def.defaultValue) })}
          onClick={() => {
            resetSettingValueCmd(def.id)
          }}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
      {def.type === 'slider' && (
        <SliderValue key={profile.id} def={def} value={value as number} labelId={labelId} />
      )}
      {def.type === 'select' && def.display === 'radio' && (
        <div role="radiogroup" aria-labelledby={labelId} className="grid gap-1 pl-1">
          {def.options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                className="size-4 accent-sky-500"
                name={`${labelId}-radio`}
                checked={value === o.id}
                onChange={() => {
                  setSettingValueCmd(def.id, o.id)
                }}
              />
              {o.name}
            </label>
          ))}
        </div>
      )}
      {def.type === 'select' && def.display !== 'radio' && (
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

/** «Сбросить все настройки» профиля — с подтверждением */
function ResetAll({ profile }: { profile: Profile }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex justify-end px-2">
      <Button
        size="sm"
        variant="outline"
        disabled={Object.keys(profile.settingValues).length === 0}
        onClick={() => {
          setAsking(true)
        }}
      >
        <RotateCcw />
        {t.resetAll}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t.resetAllTitle}
        description={fill(t.resetAllText, { profile: profile.name })}
        confirmLabel={t.resetAllConfirm}
        onConfirm={() => {
          resetAllSettingValuesCmd()
          setAsking(false)
        }}
      />
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
    <div className="grid gap-4">
      <ResetAll profile={profile} />
      {sections.map((s) => (
        <section
          key={s.group}
          id={`settings-${s.group}`}
          aria-label={s.group}
          className="grid scroll-mt-2 gap-1"
        >
          <h3 className="px-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            {s.group}
          </h3>
          {/* Подразделы и две колонки на широкой панели, как в меню игры */}
          {columnLayout(s.settings).map((block) => (
            <div key={block.subgroup ?? ''} className="grid gap-1">
              {block.subgroup && (
                <h4 className="px-2 pt-1 text-xs font-semibold tracking-wide uppercase">
                  {block.subgroup}
                </h4>
              )}
              <div className="grid gap-x-3 @min-[620px]:grid-cols-2">
                {[block.left, block.right].map((column, i) => (
                  <div key={i} className="grid content-start">
                    {column.map((def) =>
                      def.type === 'info' ? (
                        <InfoBlock key={def.id} def={def} />
                      ) : (
                        <SettingRow key={def.id} def={def} profile={profile} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
