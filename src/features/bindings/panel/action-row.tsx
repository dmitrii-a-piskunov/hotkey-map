import { ChevronDown } from 'lucide-react'
import { memo } from 'react'
import { bindingsOfAction, hasCustomParam } from '@/domain/bindings'
import { violationsOf } from '@/domain/conflicts'
import type { Action, Binding, Game, Profile } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'
import { comboName, pressTypeName, violationText } from '../format'
import { useCurrentIssues } from '../use-bindings'
import { BindingOptionsMenu, SlotButton } from './slot-button'

function slotsOf(game: Game, profile: Profile, actionId: string): (1 | 2)[] {
  // Бинд в лишнем слоте (правило сменилось с 2 на 1) тоже виден — как нарушение
  const extra = profile.bindings.some((b) => b.actionId === actionId && b.slot === 2)
  return game.rules.maxKeysPerAction === 2 || extra ? [1, 2] : [1]
}

/** Тип нажатия и параметр, отличные от умолчаний, — прямо в строке (FR-12) */
function CustomOptions({ game, bindings }: { game: Game; bindings: Binding[] }) {
  const custom = bindings.filter((b) => b.pressType !== 'press' || hasCustomParam(game, b))
  if (custom.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {custom.map((b) => {
        const parts = [
          b.pressType !== 'press' ? pressTypeName(b.pressType) : null,
          hasCustomParam(game, b)
            ? game.bindParam?.options.find((o) => o.id === b.paramOptionId)?.name
            : null,
        ].filter(Boolean)
        return (
          <BindingOptionsMenu key={b.id} game={game} binding={b}>
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1 rounded border bg-muted/50 px-1.5 text-xs"
            >
              {bindings.length > 1 && `${comboName(b.input)}: `}
              {parts.join(' · ')}
              <ChevronDown className="size-3" />
            </button>
          </BindingOptionsMenu>
        )
      })}
    </div>
  )
}

const mainContexts = new WeakMap<Game, string | undefined>()

/**
 * Основной контекст игры — тот, где больше всего действий («Везде» или
 * «Общий» в Dota 2). В строках раздела его не пишем, чтобы не шуметь
 */
function mainContextId(game: Game): string | undefined {
  if (!mainContexts.has(game)) {
    const counts = new Map<string, number>()
    for (const a of game.actions) counts.set(a.contextId, (counts.get(a.contextId) ?? 0) + 1)
    const [top] = [...counts].sort((x, y) => y[1] - x[1])
    mainContexts.set(game, top?.[0])
  }
  return mainContexts.get(game)
}

interface ActionRowProps {
  game: Game
  profile: Profile
  action: Action
  /** Надпись пустой кнопки, например «Назначить клавишу» во вкладке «Без клавиши» */
  emptyLabel?: string
  /** Подсветка клавиш действия при наведении и клике (FR-16) */
  onHover?: (hovered: boolean) => void
  onPick?: () => void
  picked?: boolean
  /**
   * Строка в разделе категории, как в меню игры: без метки категории,
   * контекст — только если не основной для игры
   */
  compact?: boolean
}

/**
 * Строка действия (FR-12): название, метка категории, контекст, кнопки
 * клавиш, тип нажатия и параметр; под кнопками — захват, ошибка правил,
 * конфликт и нарушения. Под memo: панель перерисовывается при каждом
 * изменении выделения, а строки с теми же данными — нет.
 */
export const ActionRow = memo(function ActionRow({
  game,
  profile,
  action,
  emptyLabel,
  onHover,
  onPick,
  picked = false,
  compact = false,
}: ActionRowProps) {
  const issues = useCurrentIssues()
  const category = game.categories.find((c) => c.id === action.categoryId)
  const context = game.contexts.find((c) => c.id === action.contextId)
  const slots = slotsOf(game, profile, action.id)
  const bindings = bindingsOfAction(profile, action.id)
  const violations = bindings.flatMap((b) => violationsOf(issues, b.id))
  const meta = compact
    ? context && context.id !== mainContextId(game)
      ? context.name
      : null
    : [category?.name ?? ru.panel.uncategorized, context?.name].filter(Boolean).join(' · ')

  return (
    <div
      role="group"
      aria-label={action.name}
      data-action-id={action.id}
      data-picked={picked || undefined}
      className={cn(
        'grid gap-1.5 rounded-md px-2 hover:bg-muted/60',
        compact ? 'py-1' : 'py-1.5',
        picked && 'bg-muted ring-1 ring-sky-500/50',
      )}
      onMouseEnter={
        onHover &&
        (() => {
          onHover(true)
        })
      }
      onMouseLeave={
        onHover &&
        (() => {
          onHover(false)
        })
      }
      onClick={(e) => {
        // Клик по самой строке, а не по кнопкам, закрепляет подсветку
        if (onPick && !(e.target as Element).closest('button')) onPick()
      }}
    >
      <div className="flex items-center gap-2">
        {!compact && (
          <span
            className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
            style={category ? { background: category.color } : undefined}
            aria-hidden="true"
          />
        )}
        <div className="grid min-w-0 flex-1">
          <span
            className="truncate text-sm"
            title={action.nameEn ? `${action.name} (${action.nameEn})` : action.name}
          >
            {action.name}
          </span>
          {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
        </div>
        <div className="flex shrink-0 gap-1">
          {slots.map((slot) => (
            <SlotButton
              key={slot}
              game={game}
              profile={profile}
              action={action}
              slot={slot}
              emptyLabel={slot === 1 ? emptyLabel : undefined}
            />
          ))}
        </div>
      </div>
      <CustomOptions game={game} bindings={bindings} />
      {violations.map((v) => (
        <p key={`${v.kind}-${v.binding.id}`} className="text-xs text-destructive">
          {comboName(v.binding.input)}: {violationText(v)}
        </p>
      ))}
    </div>
  )
})
