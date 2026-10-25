import { useState } from 'react'
import { bindingInSlot, commonParam } from '@/domain/bindings'
import { byOrder } from '@/domain/order'
import { shortLabelOf } from '@/domain/short-label'
import type { Action, Game, Profile } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'
import { setParamForActionsCmd } from '../commands'
import { comboName } from '../format'
import { startCapture, useBindingsUi } from '../ui-store'
import { useCurrentIssues } from '../use-bindings'

/**
 * Основные ячейки предметов — 3×2, как в Dota 2. Остальные (нейтральный
 * предмет, свиток телепортации) — отдельной колонкой за чертой
 */
const MAIN_ITEMS = 6

/** Ячейка способности или предмета: клавиша в углу, короткая подпись в центре */
function SlotCell({ profile, action }: { profile: Profile; action: Action }) {
  const binding = bindingInSlot(profile, action.id, 1)
  const issues = useCurrentIssues()
  const active = useBindingsUi((s) => s.capture?.actionId === action.id)
  const bad = binding !== undefined && issues.bindingIds.has(binding.id)
  const combo = binding ? comboName(binding.input) : null
  return (
    <button
      type="button"
      data-capture-slot
      title={action.name}
      aria-label={`${action.name}: ${combo ?? ru.bindings.notAssigned}`}
      className={cn(
        'relative flex aspect-square min-w-0 items-center justify-center rounded-md border-2 bg-muted/40 text-sm font-semibold hover:border-sky-500/60',
        active && 'border-sky-500 ring-2 ring-sky-500/40',
        bad && !active && 'border-destructive',
      )}
      onClick={() => {
        startCapture({ actionId: action.id, slot: 1 })
      }}
    >
      {combo && (
        <span className="absolute top-0.5 left-0.5 max-w-[calc(100%-4px)] truncate rounded bg-background/90 px-1 text-[10px] leading-4 font-semibold shadow-xs">
          {combo}
        </span>
      )}
      <span className="mt-2 text-muted-foreground">{shortLabelOf(action)}</span>
    </button>
  )
}

/** Кружки режима каста для группы ячеек (FR-09), как в Dota 2 */
function CastMode({
  game,
  profile,
  actions,
  label,
}: {
  game: Game
  profile: Profile
  actions: Action[]
  label: string
}) {
  const param = game.bindParam
  if (!param || actions.length === 0) return null
  const ids = actions.map((a) => a.id)
  const current = commonParam(game, profile, ids)
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs"
    >
      {param.options.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-center gap-1">
          <input
            type="radio"
            name={`${label}-${ids[0] ?? ''}`}
            checked={current === o.id}
            onChange={() => {
              setParamForActionsCmd(ids, o.id)
            }}
          />
          {o.name}
        </label>
      ))}
    </div>
  )
}

/**
 * «Способности и предметы» (категория с display: 'slots'), как в Dota 2:
 * вкладки по контекстам, ячейки способностей и предметов, режим каста.
 * Действия контекста «Везде» — предметы, общие для всех вкладок.
 */
export function SlotsBlock({
  game,
  profile,
  actions,
}: {
  game: Game
  profile: Profile
  actions: Action[]
}) {
  const sorted = byOrder(actions)
  const globalId = game.contexts.find((c) => c.isGlobal)?.id
  const items = sorted.filter((a) => a.contextId === globalId)
  const tabs = game.contexts.filter((c) => !c.isGlobal && sorted.some((a) => a.contextId === c.id))
  const [tabId, setTabId] = useState(tabs[0]?.id)
  const tab = tabs.find((c) => c.id === tabId) ?? tabs[0]
  const abilities = tab ? sorted.filter((a) => a.contextId === tab.id) : []

  return (
    <div data-testid="slots-block" className="grid gap-2 rounded-md border bg-muted/20 p-2">
      {tabs.length > 1 && (
        <div role="tablist" className="flex flex-wrap gap-1">
          {tabs.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === tab?.id}
              className={cn(
                'rounded-full px-3 py-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase',
                c.id === tab?.id && 'bg-secondary text-foreground',
              )}
              onClick={() => {
                setTabId(c.id)
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 @min-[620px]:grid-cols-[3fr_2fr]">
        {abilities.length > 0 && (
          <div className="grid content-start gap-2">
            <div className="grid grid-cols-6 gap-1.5">
              {abilities.map((a) => (
                <SlotCell key={a.id} profile={profile} action={a} />
              ))}
            </div>
            <CastMode
              game={game}
              profile={profile}
              actions={abilities}
              label={`${game.bindParam?.name ?? ''}: ${tab?.name ?? ''}`}
            />
          </div>
        )}
        {items.length > 0 && (
          <div className="grid content-start gap-2">
            <div className="flex gap-1.5">
              <div className="grid flex-3 grid-cols-3 gap-1.5">
                {items.slice(0, MAIN_ITEMS).map((a) => (
                  <SlotCell key={a.id} profile={profile} action={a} />
                ))}
              </div>
              {items.length > MAIN_ITEMS && (
                <div
                  data-testid="extra-items"
                  className="grid flex-1 content-start gap-1.5 border-l pl-1.5"
                >
                  {items.slice(MAIN_ITEMS).map((a) => (
                    <SlotCell key={a.id} profile={profile} action={a} />
                  ))}
                </div>
              )}
            </div>
            <CastMode
              game={game}
              profile={profile}
              actions={items}
              label={`${game.bindParam?.name ?? ''}: ${ru.panel.items}`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
