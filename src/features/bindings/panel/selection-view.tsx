import { Plus, Search, X } from 'lucide-react'
import { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matchesAction } from '@/domain/actions'
import { bindingsOnInput, freeSlot, layerModifiers } from '@/domain/bindings'
import { byOrder } from '@/domain/order'
import { DEFAULT_BLOCKED_KEYS } from '@/domain/schema'
import type { Action, Game, Profile } from '@/domain/types'
import { useDevicesStore } from '@/features/devices/store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { assignActionToInputCmd } from '../commands'
import { comboName, inputName } from '../format'
import { useBindingsUi } from '../ui-store'
import { ActionRow } from './action-row'
import { CreateGroupButton } from './key-group-dialog'

/** Действия на входе: все слои, текущий — первым, без повторов */
function actionsOnInput(game: Game, profile: Profile, code: string, layer: string): Action[] {
  const ids = [...new Set(bindingsOnInput(profile, code, layer).map((b) => b.actionId))]
  return ids
    .map((id) => game.actions.find((a) => a.id === id))
    .filter((a): a is Action => a !== undefined)
}

function isBlocked(game: Game, code: string): boolean {
  return DEFAULT_BLOCKED_KEYS.includes(code) || game.rules.blockedKeys.includes(code)
}

/**
 * «Назначить действие» на клавишу (раздел 8.2, TC-01, TC-02): список с
 * поиском. Действие, у которого заняты все клавиши, выбрать нельзя.
 */
function ActionPicker({ game, profile, code }: { game: Game; profile: Profile; code: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const layer = useBindingsUi((s) => s.layer)
  const combo = comboName({ code, modifiers: layerModifiers(layer) })
  const actions = byOrder(game.actions).filter((a) => matchesAction(a, query))
  const busyText = fill(ru.bindings.errors.noFreeSlot, { max: game.rules.maxKeysPerAction })

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          {ru.panel.assignAction}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="grid w-80 gap-2 p-2"
        aria-label={fill(ru.panel.pickAction, { key: combo })}
      >
        <p className="px-1 text-xs font-medium text-muted-foreground">
          {fill(ru.panel.pickAction, { key: combo })}
        </p>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            autoFocus
            aria-label={ru.panel.search}
            placeholder={ru.panel.searchPlaceholder}
            className="h-8 pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
          />
        </div>
        <ul className="grid max-h-72 overflow-y-auto">
          {actions.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{ru.panel.noResults}</li>
          )}
          {actions.map((a) => {
            const busy = freeSlot(game, profile, a.id) === null
            const category = game.categories.find((c) => c.id === a.categoryId)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={busy}
                  title={busy ? busyText : undefined}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  onClick={() => {
                    assignActionToInputCmd(a.id, code)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
                    style={category ? { background: category.color } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {busy && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ru.panel.slotsBusy}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Одна выделенная клавиша: её действия строками и «Назначить действие» (FR-13) */
function SingleInput({ game, profile, code }: { game: Game; profile: Profile; code: string }) {
  const layer = useBindingsUi((s) => s.layer)
  const actions = actionsOnInput(game, profile, code, layer)
  const blocked = isBlocked(game, code)
  return (
    <div className="grid gap-2">
      {blocked && (
        <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-sm text-destructive">
          {fill(ru.panel.notAssignable, {
            reason: fill(ru.devices.notPassedToGame, { game: game.name }),
          })}
        </p>
      )}
      {actions.length === 0 && !blocked && (
        <p className="px-2 text-sm text-muted-foreground">{ru.panel.nothingOnKey}</p>
      )}
      <div className="grid">
        {actions.map((a) => (
          <ActionRow key={a.id} game={game} profile={profile} action={a} />
        ))}
      </div>
      {!blocked &&
        (game.actions.length > 0 ? (
          <div className="px-2">
            <ActionPicker game={game} profile={profile} code={code} />
          </div>
        ) : null)}
    </div>
  )
}

/**
 * Раздел одной клавиши при выделении нескольких. Под memo: рамка меняет
 * выделение на каждом движении, и перерисовываются только новые разделы
 */
const KeySection = memo(function KeySection({
  game,
  profile,
  code,
  layer,
}: {
  game: Game
  profile: Profile
  code: string
  layer: string
}) {
  const actions = actionsOnInput(game, profile, code, layer)
  return (
    <section aria-label={inputName(code)} className="grid gap-0.5">
      <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">
        {inputName(code)}
      </h3>
      {actions.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">{ru.panel.nothingOnKey}</p>
      ) : (
        actions.map((a) => <ActionRow key={a.id} game={game} profile={profile} action={a} />)
      )}
    </section>
  )
})

/**
 * Панель выделенных клавиш (FR-13): одна — её действия; несколько —
 * действия каждой клавиши и «Создать группу» (FR-29).
 */
export function SelectionView({ game, profile }: { game: Game; profile: Profile }) {
  const selected = useDevicesStore((s) => s.selection.selected)
  const clearSelection = useDevicesStore((s) => s.clearSelection)
  const layer = useBindingsUi((s) => s.layer)
  const single = selected.length === 1 ? selected[0] : undefined

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 px-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {single ? inputName(single) : fill(ru.panel.selectedKeys, { count: selected.length })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={ru.panel.clearSelection}
          title={ru.panel.clearSelection}
          onClick={clearSelection}
        >
          <X />
        </Button>
      </div>
      {single ? (
        <SingleInput game={game} profile={profile} code={single} />
      ) : (
        <>
          <div className="px-2">
            <CreateGroupButton profile={profile} codes={selected} />
          </div>
          {selected.map((code) => (
            <KeySection key={code} game={game} profile={profile} code={code} layer={layer} />
          ))}
        </>
      )}
    </div>
  )
}
