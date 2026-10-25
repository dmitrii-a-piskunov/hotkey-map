import { Check, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ALL_MODIFIERS,
  gameImpact,
  gameNameError,
  normalizeBlockedKeys,
  parseSteamAppId,
} from '@/domain/games'
import { LIMITS } from '@/domain/names'
import { DEFAULT_BLOCKED_KEYS } from '@/domain/schema'
import type { Game, GameRules, Modifier } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import { keyboardLayout } from '@/features/devices/devices'
import { ru } from '@/i18n/ru'
import { KNOB_CODE, type KeyDef } from '@/layouts/aula-f75'
import { fill } from '@/lib/format'
import { useElementWidth } from '@/lib/use-element-width'
import { cn } from '@/lib/utils'
import { removeGameCmd, setGeneralCmd } from '../commands'
import { closeEditor } from '../ui-store'
import { IconField } from './icon-field'

const t = ru.editor.general

const keyName = (k: KeyDef) => k.label.game?.en ?? (k.label.en || k.code)

/** Клавиши на своих местах, как на клавиатуре; регулятор — круглый, справа сверху (FR-01) */
const KEYS = [
  ...keyboardLayout.keys.map((k) => ({
    code: k.code,
    name: keyName(k),
    x: k.x,
    y: k.y,
    w: k.w,
    h: k.h,
    round: false,
  })),
  ...(keyboardLayout.knob
    ? [
        {
          code: KNOB_CODE,
          name: ru.devices.knob,
          x: keyboardLayout.knob.cx - keyboardLayout.knob.d / 2,
          y: keyboardLayout.knob.cy - keyboardLayout.knob.d / 2,
          w: keyboardLayout.knob.d,
          h: keyboardLayout.knob.d,
          round: true,
        },
      ]
    : []),
]
const WIDTH_U = Math.max(...KEYS.map((k) => k.x + k.w))
const HEIGHT_U = Math.max(...KEYS.map((k) => k.y + k.h))
/** Зазор между клавишами, в юнитах */
const GAP_U = 0.08

function BlockedKeysField({
  value,
  onChange,
}: {
  value: readonly string[]
  onChange: (codes: string[]) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const unit = useElementWidth(ref) / WIDTH_U
  const blocked = new Set(value)
  return (
    <div
      ref={ref}
      role="group"
      aria-label={t.blockedKeys}
      className="relative w-full"
      style={{ height: HEIGHT_U * unit }}
    >
      {unit > 0 &&
        KEYS.map((k) => {
          const locked = DEFAULT_BLOCKED_KEYS.includes(k.code)
          const on = blocked.has(k.code)
          return (
            <button
              key={k.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={locked || undefined}
              aria-label={k.name}
              title={k.name}
              className={cn(
                'absolute flex items-center justify-center overflow-hidden rounded border px-0.5 text-[10px] leading-none',
                k.round && 'rounded-full',
                on ? 'border-destructive bg-destructive/10 text-destructive' : 'hover:bg-accent',
                locked && 'cursor-not-allowed opacity-70',
              )}
              style={{
                left: (k.x + GAP_U / 2) * unit,
                top: (k.y + GAP_U / 2) * unit,
                width: (k.w - GAP_U) * unit,
                height: (k.h - GAP_U) * unit,
              }}
              onClick={() => {
                if (locked) return
                onChange(on ? value.filter((c) => c !== k.code) : [...value, k.code])
              }}
            >
              <span className="truncate">{k.round ? '◯' : k.name}</span>
            </button>
          )
        })}
    </div>
  )
}

interface Draft {
  name: string
  steamAppId: string
  rules: GameRules
}

function draftOf(game: Game): Draft {
  return { name: game.name, steamAppId: game.steamAppId?.toString() ?? '', rules: game.rules }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.steamAppId.trim() === b.steamAppId.trim() &&
    a.rules.maxKeysPerAction === b.rules.maxKeysPerAction &&
    ALL_MODIFIERS.every(
      (m) => a.rules.allowedModifiers.includes(m) === b.rules.allowedModifiers.includes(m),
    ) &&
    normalizeBlockedKeys(a.rules.blockedKeys).sort().join() ===
      normalizeBlockedKeys(b.rules.blockedKeys).sort().join()
  )
}

/** Вкладка «Общее и правила» (FR-05) */
export function GeneralTab({ game }: { game: Game }) {
  const data = useDataStore((s) => s.data)
  const [draft, setDraft] = useState<Draft>(() => draftOf(game))
  const [justSaved, setJustSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // AppID пришёл из ярлыка Steam: показываем его в пустом поле
  const [seenAppId, setSeenAppId] = useState(game.steamAppId)
  if (game.steamAppId !== seenAppId) {
    setSeenAppId(game.steamAppId)
    if (game.steamAppId !== undefined && draft.steamAppId.trim() === '') {
      setDraft({ ...draft, steamAppId: String(game.steamAppId) })
    }
  }

  const nameError = nameErrorText(gameNameError(data, draft.name, game.id), LIMITS.game)
  const appId = parseSteamAppId(draft.steamAppId)
  const appIdError = appId.error ? t.steamAppIdError : null
  const dirty = !sameDraft(draft, draftOf(game))
  const invalid = nameError !== null || appIdError !== null
  const impact = gameImpact(game)

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }))
    setJustSaved(false)
  }
  function updateRules(patch: Partial<GameRules>) {
    update({ rules: { ...draft.rules, ...patch } })
  }

  return (
    <form
      className="grid max-w-2xl gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid || !dirty) return
        setGeneralCmd(game.id, { name: draft.name, steamAppId: appId.value, rules: draft.rules })
        setJustSaved(true)
      }}
    >
      <Field label={t.name} htmlFor="game-name" error={nameError}>
        <Input
          id="game-name"
          value={draft.name}
          onChange={(e) => {
            update({ name: e.target.value })
          }}
          {...invalidProps('game-name', nameError)}
        />
      </Field>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t.icon}</span>
        <IconField game={game} steamAppId={appId.value} />
      </div>

      <Field label={t.steamAppId} htmlFor="game-steam" error={appIdError} className="max-w-48">
        <Input
          id="game-steam"
          inputMode="numeric"
          value={draft.steamAppId}
          onChange={(e) => {
            update({ steamAppId: e.target.value })
          }}
          {...invalidProps('game-steam', appIdError)}
        />
      </Field>

      <fieldset className="grid gap-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">{t.rules}</legend>
        <div className="flex flex-wrap items-center gap-6">
          <div className="grid gap-1.5">
            <span className="text-sm">{t.keysPerAction}</span>
            <ToggleGroup
              type="single"
              aria-label={t.keysPerAction}
              value={String(draft.rules.maxKeysPerAction)}
              onValueChange={(v) => {
                if (v === '1' || v === '2') updateRules({ maxKeysPerAction: v === '1' ? 1 : 2 })
              }}
            >
              <ToggleGroupItem value="1">1</ToggleGroupItem>
              <ToggleGroupItem value="2">2</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm">{t.modifiers}</span>
            <ToggleGroup
              type="multiple"
              aria-label={t.modifiers}
              value={draft.rules.allowedModifiers}
              onValueChange={(v) => {
                updateRules({
                  allowedModifiers: ALL_MODIFIERS.filter((m: Modifier) => v.includes(m)),
                })
              }}
            >
              {ALL_MODIFIERS.map((m) => (
                <ToggleGroupItem key={m} value={m}>
                  {t.modifierNames[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t.rulesHint}</p>
        <div className="grid gap-1.5">
          <span className="text-sm">{t.blockedKeys}</span>
          <BlockedKeysField
            value={draft.rules.blockedKeys}
            onChange={(codes) => {
              updateRules({ blockedKeys: codes })
            }}
          />
          <p className="text-xs text-muted-foreground">{t.blockedKeysHint}</p>
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          onClick={() => {
            setConfirmDelete(true)
          }}
        >
          <Trash2 />
          {t.deleteGame}
        </Button>
        <div className="flex items-center gap-3">
          {justSaved && !dirty && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Check className="size-4" />
              {t.saved}
            </span>
          )}
          <Button type="submit" disabled={invalid || !dirty}>
            {ru.common.save}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={fill(t.deleteTitle, { name: game.name })}
        description={fill(t.deleteText, { ...impact })}
        onConfirm={() => {
          closeEditor()
          removeGameCmd(game.id)
        }}
      />
    </form>
  )
}
