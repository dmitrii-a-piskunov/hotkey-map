import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { removeGameCmd, setGeneralCmd } from '../commands'
import { closeEditor } from '../ui-store'
import { IconField } from './icon-field'

const t = ru.editor.general

const ROWS: KeyDef['profileRow'][] = ['F', 'R1', 'R2', 'R3', 'R4', 'R5']

const keyName = (k: KeyDef) => k.label.game?.en ?? (k.label.en || k.code)

/** Клавиши по рядам раскладки; регулятор — в ряду F (FR-01) */
const KEY_ROWS = ROWS.map((row) => {
  const keys = keyboardLayout.keys
    .filter((k) => k.profileRow === row)
    .sort((a, b) => a.x - b.x)
    .map((k) => ({ code: k.code, name: keyName(k) }))
  return row === 'F' && keyboardLayout.knob
    ? [...keys, { code: KNOB_CODE, name: ru.devices.knob }]
    : keys
})

function BlockedKeysField({
  value,
  onChange,
}: {
  value: readonly string[]
  onChange: (codes: string[]) => void
}) {
  const blocked = new Set(value)
  return (
    <div className="grid gap-1" role="group" aria-label={t.blockedKeys}>
      {KEY_ROWS.map((row, i) => (
        <div key={ROWS[i]} className="flex flex-wrap gap-1">
          {row.map((k) => {
            const locked = DEFAULT_BLOCKED_KEYS.includes(k.code)
            const on = blocked.has(k.code)
            return (
              <button
                key={k.code}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={locked || undefined}
                title={k.code}
                className={cn(
                  'min-w-8 rounded border px-1.5 py-0.5 text-xs',
                  on ? 'border-destructive bg-destructive/10 text-destructive' : 'hover:bg-accent',
                  locked && 'cursor-not-allowed opacity-70',
                )}
                onClick={() => {
                  if (locked) return
                  onChange(on ? value.filter((c) => c !== k.code) : [...value, k.code])
                }}
              >
                {k.name}
              </button>
            )
          })}
        </div>
      ))}
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
