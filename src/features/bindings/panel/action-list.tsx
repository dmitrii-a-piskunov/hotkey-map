import { ListPlus, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { actionSections, searchSections, type ActionSection } from '@/domain/actions'
import { columnLayout } from '@/domain/layout'
import type { Action, Game, Profile } from '@/domain/types'
import { openEditor } from '@/features/games/ui-store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { clearHoverHighlightCmd, highlightActionCmd, removeAllBindingsCmd } from '../commands'
import { setHighlight, useBindingsUi } from '../ui-store'
import { ActionRow } from './action-row'
import { SlotsBlock } from './slots-block'

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

/** «Сбросить настройки управления»: снять все бинды профиля после подтверждения */
function ResetBindings({ profile }: { profile: Profile }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-9 shrink-0"
        disabled={profile.bindings.length === 0}
        onClick={() => {
          setAsking(true)
        }}
      >
        <RotateCcw />
        {ru.panel.resetBindings}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={ru.panel.resetBindingsTitle}
        description={fill(ru.panel.resetBindingsText, {
          profile: profile.name,
          count: profile.bindings.length,
        })}
        confirmLabel={ru.values.resetAllConfirm}
        onConfirm={() => {
          removeAllBindingsCmd()
          setAsking(false)
        }}
      />
    </>
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
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
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
        <ResetBindings profile={profile} />
      </div>
      {searching && sections.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">{ru.panel.noResults}</p>
      )}
      <div data-testid="panel-actions" className="grid gap-4">
        {sections.map((s) => (
          <CategorySection
            key={s.category?.id ?? 'none'}
            game={game}
            profile={profile}
            section={s}
            searching={searching}
            renderRow={(a) => (
              <ActionRow
                key={a.id}
                game={game}
                profile={profile}
                action={a}
                compact
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
            )}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Раздел категории как в меню игры: заголовок, пояснение, подразделы и две
 * колонки на широкой панели. «Способности и предметы» — ячейками. При
 * поиске — просто найденные строки.
 */
function CategorySection({
  game,
  profile,
  section,
  searching,
  renderRow,
}: {
  game: Game
  profile: Profile
  section: ActionSection
  searching: boolean
  renderRow: (a: Action) => ReactNode
}) {
  const { category } = section
  const title = category?.name ?? ru.panel.uncategorized
  let body: ReactNode
  if (category?.display === 'slots' && !searching) {
    body = <SlotsBlock game={game} profile={profile} actions={section.actions} />
  } else {
    body = columnLayout(section.actions).map((block) => (
      <div key={block.subgroup ?? ''} className="grid gap-1">
        {block.subgroup && (
          <h4 className="px-2 pt-1 text-xs font-semibold tracking-wide uppercase">
            {block.subgroup}
          </h4>
        )}
        <div className="grid gap-x-3 @min-[620px]:grid-cols-2">
          <div className="grid content-start">{block.left.map(renderRow)}</div>
          <div className="grid content-start">{block.right.map(renderRow)}</div>
        </div>
      </div>
    ))
  }
  return (
    <section
      id={category ? `section-${category.id}` : 'section-none'}
      aria-label={title}
      className="grid scroll-mt-2 gap-1.5"
    >
      <h3 className="flex items-center gap-2 px-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <span
          className="size-2.5 rounded-full bg-muted-foreground/40"
          style={category ? { background: category.color } : undefined}
          aria-hidden="true"
        />
        {title}
      </h3>
      {category?.note && !searching && (
        <p className="px-2 text-xs text-muted-foreground">{category.note}</p>
      )}
      {body}
    </section>
  )
}

/** «Без клавиши» (FR-17): действия без бинда в текущем профиле */
export function UnboundList({ game, profile }: { game: Game; profile: Profile }) {
  // Действие остаётся в списке, пока открыто его окно привязки
  const kept = useBindingsUi((s) => s.capture?.actionId)
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
