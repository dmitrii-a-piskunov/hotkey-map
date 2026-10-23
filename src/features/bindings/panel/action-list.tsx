import { ListPlus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { actionSections, searchSections } from '@/domain/actions'
import type { Game, Profile } from '@/domain/types'
import { openEditor } from '@/features/games/ui-store'
import { ru } from '@/i18n/ru'
import { clearHoverHighlightCmd, highlightActionCmd } from '../commands'
import { setHighlight, useBindingsUi } from '../ui-store'
import { ActionRow } from './action-row'

/** «В игре пока нет действий» и кнопка «Добавить действие» (раздел 8.2) */
export function NoActions({ game }: { game: Game }) {
  return (
    <div className="grid justify-items-center gap-3 p-6 text-center">
      <p className="text-sm font-medium">{ru.panel.noActions}</p>
      <Button
        size="sm"
        onClick={() => {
          openEditor(game.id, 'actions')
        }}
      >
        <ListPlus />
        {ru.panel.addAction}
      </Button>
    </div>
  )
}

/**
 * Список действий игры с поиском (FR-13, FR-16): разделы по категориям, как
 * в меню игры. Наведение подсвечивает клавиши действия, клик закрепляет.
 */
export function ActionList({ game, profile }: { game: Game; profile: Profile }) {
  const [query, setQuery] = useState('')
  const pinned = useBindingsUi((s) => (s.highlight?.pinned ? s.highlight.actionId : null))
  const searching = query.trim() !== ''
  const sections = (searching ? searchSections(game, query) : actionSections(game)).filter(
    (s) => s.actions.length > 0,
  )

  // Уход из списка снимает подсветку поиска
  useEffect(
    () => () => {
      setHighlight(null)
    },
    [],
  )

  if (game.actions.length === 0) return <NoActions game={game} />

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={ru.panel.search}
          placeholder={ru.panel.searchPlaceholder}
          className="pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(null)
          }}
        />
      </div>
      {searching && sections.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">{ru.panel.noResults}</p>
      )}
      <div data-testid="panel-actions" className="grid gap-3">
        {sections.map((s) => (
          <section
            key={s.category?.id ?? 'none'}
            aria-label={s.category?.name ?? ru.panel.uncategorized}
          >
            <h3 className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground uppercase">
              {s.category?.name ?? ru.panel.uncategorized}
            </h3>
            <div className="grid">
              {s.actions.map((a) => (
                <ActionRow
                  key={a.id}
                  game={game}
                  profile={profile}
                  action={a}
                  picked={pinned === a.id}
                  onHover={(hovered) => {
                    if (pinned) return
                    if (hovered) highlightActionCmd(a.id, false)
                    else clearHoverHighlightCmd()
                  }}
                  onPick={() => {
                    if (pinned === a.id) setHighlight(null)
                    else highlightActionCmd(a.id, true)
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** «Без клавиши» (FR-17): действия без бинда в текущем профиле */
export function UnboundList({ game, profile }: { game: Game; profile: Profile }) {
  // Действие, которому только что назначили клавишу, остаётся в списке, пока под
  // ним предупреждение о конфликте или ошибка
  const kept = useBindingsUi((s) => s.feedback?.actionId)
  const bound = new Set(profile.bindings.map((b) => b.actionId))
  const sections = actionSections(game)
    .map((s) => ({ ...s, actions: s.actions.filter((a) => !bound.has(a.id) || a.id === kept) }))
    .filter((s) => s.actions.length > 0)

  if (game.actions.length === 0) return <NoActions game={game} />
  if (sections.length === 0) {
    return <p className="p-4 text-center text-sm text-muted-foreground">{ru.panel.allBound}</p>
  }
  return (
    <div data-testid="panel-unbound" className="grid gap-3">
      {sections.map((s) => (
        <section
          key={s.category?.id ?? 'none'}
          aria-label={s.category?.name ?? ru.panel.uncategorized}
        >
          <h3 className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase">
            {s.category?.name ?? ru.panel.uncategorized}
          </h3>
          {s.actions.map((a) => (
            <ActionRow
              key={a.id}
              game={game}
              profile={profile}
              action={a}
              emptyLabel={ru.panel.assignKey}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
