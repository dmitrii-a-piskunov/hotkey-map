import { ListPlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { SectionedSortable, SortableRow } from '@/components/common/sortable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { systemClock } from '@/domain/clock'
import { LIMITS } from '@/domain/names'
import {
  settingDraftErrors,
  settingSections,
  settingUpdateImpact,
  settingValueImpact,
  sliderRangeChanged,
  type SettingDraft,
  type SettingType,
} from '@/domain/settings-template'
import type { Game, SettingDef } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill, formatDecimal, parseDecimal } from '@/lib/format'
import { addSettingCmd, moveSettingCmd, removeSettingCmd, updateSettingCmd } from '../commands'

const t = ru.editor.settings
const TYPES: readonly SettingType[] = ['slider', 'toggle', 'select', 'text', 'info']

/** Поля формы как текст: числа вводятся с запятой (раздел 8.6) */
interface Form {
  type: SettingType
  group: string
  name: string
  unit: string
  min: string
  max: string
  step: string
  sliderDefault: string
  toggleDefault: boolean
  options: { id: string; name: string }[]
  selectDefault: string
  /** Список выпадающий или кружками, как в меню игры */
  selectDisplay: 'list' | 'radio'
  textDefault: string
  infoText: string
}

function formOf(def: SettingDef | null, group: string): Form {
  const optionId = systemClock.id()
  const form: Form = {
    type: def?.type ?? 'slider',
    group: def?.group ?? group,
    name: def?.name ?? '',
    unit: def?.unit ?? '',
    min: '0',
    max: '100',
    step: '1',
    sliderDefault: '50',
    toggleDefault: false,
    options: [{ id: optionId, name: '' }],
    selectDefault: optionId,
    selectDisplay: 'list',
    textDefault: '',
    infoText: '',
  }
  switch (def?.type) {
    case 'slider':
      return {
        ...form,
        min: formatDecimal(def.min),
        max: formatDecimal(def.max),
        step: formatDecimal(def.step),
        sliderDefault: formatDecimal(def.defaultValue),
      }
    case 'toggle':
      return { ...form, toggleDefault: def.defaultValue }
    case 'select':
      return {
        ...form,
        options: def.options.map((o) => ({ ...o })),
        selectDefault: def.defaultValue,
        selectDisplay: def.display ?? 'list',
      }
    case 'text':
      return { ...form, textDefault: def.defaultValue }
    case 'info':
      return { ...form, infoText: def.text }
    default:
      return form
  }
}

/**
 * Черновик из формы. Колонку, подраздел и высоту пояснения форма не
 * показывает: они приходят из заготовки и при правке сохраняются
 */
function draftOf(f: Form, setting: SettingDef | null): SettingDraft {
  const base = {
    group: f.group,
    name: f.name,
    unit: f.unit,
    ...(setting?.column !== undefined && { column: setting.column }),
    ...(setting?.subgroup !== undefined && { subgroup: setting.subgroup }),
  }
  const num = (s: string) => parseDecimal(s) ?? Number.NaN
  switch (f.type) {
    case 'slider':
      return {
        ...base,
        type: 'slider',
        min: num(f.min),
        max: num(f.max),
        step: num(f.step),
        defaultValue: num(f.sliderDefault),
      }
    case 'toggle':
      return { ...base, type: 'toggle', defaultValue: f.toggleDefault }
    case 'select':
      return {
        ...base,
        type: 'select',
        options: f.options,
        defaultValue: f.selectDefault,
        ...(f.selectDisplay === 'radio' && { display: 'radio' as const }),
      }
    case 'text':
      return { ...base, type: 'text', defaultValue: f.textDefault }
    case 'info':
      return {
        ...base,
        type: 'info',
        text: f.infoText,
        ...(setting?.type === 'info' && setting.height !== undefined && { height: setting.height }),
      }
  }
}

function SettingDialog({
  game,
  setting,
  group,
  onClose,
}: {
  game: Game
  setting: SettingDef | null
  group: string
  onClose: () => void
}) {
  const id = useId()
  const [form, setForm] = useState<Form>(() => formOf(setting, group))
  const [touched, setTouched] = useState(setting !== null)
  const draft = draftOf(form, setting)
  const errors = settingDraftErrors(draft)
  const invalid = Object.keys(errors).length > 0
  const show = (text: string | null | undefined) => (touched ? (text ?? null) : null)
  const groups = settingSections(game).map((s) => s.group)

  const impact = setting && !invalid ? settingUpdateImpact(game, setting.id, draft) : 0
  const rangeChanged = setting !== null && sliderRangeChanged(setting, draft)

  function update(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }))
    setTouched(true)
  }

  const groupError = show(nameErrorText(errors.group, LIMITS.settingGroup))
  const nameError = show(nameErrorText(errors.name, LIMITS.setting))
  const unitError = show(nameErrorText(errors.unit, LIMITS.unit))

  const numberField = (
    key: 'min' | 'max' | 'step' | 'sliderDefault',
    label: string,
    error?: string | null,
  ) => (
    <Field label={label} htmlFor={`${id}-${key}`} error={error}>
      <Input
        id={`${id}-${key}`}
        inputMode="decimal"
        value={form[key]}
        onChange={(e) => {
          update({ [key]: e.target.value })
        }}
        {...invalidProps(`${id}-${key}`, error)}
      />
    </Field>
  )

  let typeFields: ReactNode = null
  switch (form.type) {
    case 'slider':
      typeFields = (
        <div className="grid grid-cols-4 gap-3">
          {numberField('min', t.min, show(errors.range ? t.rangeError : null))}
          {numberField('max', t.max)}
          {numberField('step', t.step, show(errors.step ? t.stepError : null))}
          {numberField(
            'sliderDefault',
            t.defaultValue,
            show(errors.defaultValue ? t.defaultError : null),
          )}
        </div>
      )
      break
    case 'toggle':
      typeFields = (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t.defaultValue}</span>
          <ToggleGroup
            type="single"
            aria-label={t.defaultValue}
            className="w-fit"
            value={form.toggleDefault ? 'on' : 'off'}
            onValueChange={(v) => {
              if (v) update({ toggleDefault: v === 'on' })
            }}
          >
            <ToggleGroupItem value="on">{t.on}</ToggleGroupItem>
            <ToggleGroupItem value="off">{t.off}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )
      break
    case 'select':
      typeFields = (
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t.options}</span>
          <div className="grid gap-1.5" role="radiogroup" aria-label={t.defaultValue}>
            {form.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-default`}
                  aria-label={`${t.defaultValue}: ${o.name || String(i + 1)}`}
                  checked={form.selectDefault === o.id}
                  onChange={() => {
                    update({ selectDefault: o.id })
                  }}
                />
                <Input
                  aria-label={`${t.options} ${i + 1}`}
                  className="h-8"
                  value={o.name}
                  onChange={(e) => {
                    update({
                      options: form.options.map((x) =>
                        x.id === o.id ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`${ru.common.delete}: ${o.name || String(i + 1)}`}
                  onClick={() => {
                    const options = form.options.filter((x) => x.id !== o.id)
                    update({
                      options,
                      selectDefault:
                        form.selectDefault === o.id ? (options[0]?.id ?? '') : form.selectDefault,
                    })
                  }}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
          {touched && errors.options && (
            <p className="text-xs text-destructive">{t.optionsError}</p>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                update({ options: [...form.options, { id: systemClock.id(), name: '' }] })
              }}
            >
              <Plus />
              {t.addOption}
            </Button>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t.display}</span>
            <ToggleGroup
              type="single"
              aria-label={t.display}
              className="w-fit"
              value={form.selectDisplay}
              onValueChange={(v) => {
                if (v === 'list' || v === 'radio') update({ selectDisplay: v })
              }}
            >
              <ToggleGroupItem value="list">{t.displayList}</ToggleGroupItem>
              <ToggleGroupItem value="radio">{t.displayRadio}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      )
      break
    case 'text': {
      const error = show(errors.defaultValue ? t.textDefaultError : null)
      typeFields = (
        <Field label={t.defaultValue} htmlFor={`${id}-text`} error={error}>
          <Input
            id={`${id}-text`}
            value={form.textDefault}
            onChange={(e) => {
              update({ textDefault: e.target.value })
            }}
            {...invalidProps(`${id}-text`, error)}
          />
        </Field>
      )
      break
    }
    case 'info': {
      const error = show(errors.text ? t.infoError : null)
      typeFields = (
        <Field label={t.infoText} htmlFor={`${id}-info`} error={error}>
          <Textarea
            id={`${id}-info`}
            rows={4}
            value={form.infoText}
            onChange={(e) => {
              update({ infoText: e.target.value })
            }}
            {...invalidProps(`${id}-info`, error)}
          />
        </Field>
      )
      break
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent closeLabel={ru.common.close} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{setting ? t.editTitle : t.newTitle}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (invalid) return
            if (setting) updateSettingCmd(game.id, setting.id, draft)
            else addSettingCmd(game.id, draft)
            onClose()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.group} htmlFor={`${id}-group`} error={groupError}>
              <Input
                id={`${id}-group`}
                list={`${id}-groups`}
                value={form.group}
                onChange={(e) => {
                  update({ group: e.target.value })
                }}
                {...invalidProps(`${id}-group`, groupError)}
              />
              <datalist id={`${id}-groups`}>
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label={t.name} htmlFor={`${id}-name`} error={nameError}>
              <Input
                id={`${id}-name`}
                autoFocus
                value={form.name}
                onChange={(e) => {
                  update({ name: e.target.value })
                }}
                {...invalidProps(`${id}-name`, nameError)}
              />
            </Field>
            <Field label={t.type} htmlFor={`${id}-type`}>
              <NativeSelect
                id={`${id}-type`}
                value={form.type}
                onChange={(e) => {
                  const type = TYPES.find((x) => x === e.target.value)
                  if (type) update({ type })
                }}
              >
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t.types[x]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.unit} htmlFor={`${id}-unit`} error={unitError}>
              <Input
                id={`${id}-unit`}
                value={form.unit}
                onChange={(e) => {
                  update({ unit: e.target.value })
                }}
                {...invalidProps(`${id}-unit`, unitError)}
              />
            </Field>
          </div>
          {typeFields}
          {rangeChanged && !invalid && (
            <p role="status" className="text-sm text-warning">
              {fill(t.rangeWarning, { count: impact })}
            </p>
          )}
          {!rangeChanged && impact > 0 && (
            <p role="status" className="text-sm text-warning">
              {fill(t.resetWarning, { count: impact })}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {ru.common.cancel}
            </Button>
            <Button type="submit" disabled={touched && invalid}>
              {setting ? ru.common.save : ru.common.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function describe(def: SettingDef): string {
  const unit = def.unit ? ` ${def.unit}` : ''
  switch (def.type) {
    case 'slider':
      return `${formatDecimal(def.min)}–${formatDecimal(def.max)}${unit}, ${t.defaultValue.toLowerCase()} ${formatDecimal(def.defaultValue)}`
    case 'toggle':
      return `${t.types.toggle}, ${def.defaultValue ? t.on : t.off}`
    case 'select':
      return `${t.types.select}: ${def.options.map((o) => o.name).join(', ')}`
    case 'text':
      return t.types.text
    case 'info':
      return t.types.info
  }
}

/** Вкладка «Шаблон настроек» (FR-10) */
export function SettingsTab({ game }: { game: Game }) {
  const [editing, setEditing] = useState<{ setting: SettingDef | null; group: string } | null>(null)
  const [deleting, setDeleting] = useState<SettingDef | null>(null)
  const sections = settingSections(game)

  const row = (def: SettingDef): ReactNode => (
    <SortableRow key={def.id} id={def.id}>
      <div className="grid min-w-0 flex-1">
        <span className="truncate text-sm" title={def.name}>
          {def.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">{describe(def)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`${ru.common.edit} ${def.name}`}
        onClick={() => {
          setEditing({ setting: def, group: def.group })
        }}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label={`${ru.common.delete} ${def.name}`}
        onClick={() => {
          setDeleting(def)
        }}
      >
        <Trash2 />
      </Button>
    </SortableRow>
  )

  return (
    <div className="grid max-w-3xl gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{t.hint}</p>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing({ setting: null, group: sections.at(-1)?.group ?? '' })
          }}
        >
          <ListPlus />
          {t.addSetting}
        </Button>
      </div>
      {sections.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center font-medium">
          {t.emptyTitle}
        </p>
      ) : (
        <SectionedSortable
          sections={sections.map((s) => ({ id: s.group, items: s.settings }))}
          emptyText={ru.editor.actions.sectionEmpty}
          onMove={(id, group, index) => {
            moveSettingCmd(game.id, id, group, index)
          }}
          renderSection={(group, list, count) => (
            <section aria-label={group}>
              <h3 className="mt-3 mb-1.5 flex items-center gap-2 text-sm font-semibold">
                {group}
                <span className="text-xs font-normal text-muted-foreground">{count}</span>
              </h3>
              {list}
            </section>
          )}
          renderItem={row}
        />
      )}
      {editing && (
        <SettingDialog
          game={game}
          setting={editing.setting}
          group={editing.group}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleting(null)
          }}
          title={fill(t.deleteTitle, { name: deleting.name })}
          description={fill(t.deleteText, { count: settingValueImpact(game, null, deleting.id) })}
          onConfirm={() => {
            removeSettingCmd(game.id, deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
