import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bindingInSlot, bindingsOfAction, hasCustomParam } from '@/domain/bindings'
import { conflictsWith, violationsOf, type Violation } from '@/domain/conflicts'
import { BASE_LAYER } from '@/domain/layers'
import type { Action, Binding, Game, Profile } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { unbindOthersCmd } from '../commands'
import { comboName, layerName, modifierName, pressTypeName } from '../format'
import { setFeedback, useBindingsUi, type SlotFeedback } from '../ui-store'
import { useCurrentIssues } from '../use-bindings'
import { BindingOptionsMenu, SlotButton } from './slot-button'

const t = ru.bindings

function slotsOf(game: Game, profile: Profile, actionId: string): (1 | 2)[] {
  // Бинд в лишнем слоте (правило сменилось с 2 на 1) тоже виден — как нарушение
  const extra = profile.bindings.some((b) => b.actionId === actionId && b.slot === 2)
  return game.rules.maxKeysPerAction === 2 || extra ? [1, 2] : [1]
}

function violationText(v: Violation): string {
  switch (v.kind) {
    case 'extraSlot':
      return fill(t.violations.extraSlot, { max: v.max })
    case 'modifierNotAllowed':
      return fill(t.violations.modifierNotAllowed, {
        mods: v.modifiers.map(modifierName).join(', '),
      })
    case 'blockedKey':
      return t.violations.blockedKey
  }
}

function feedbackError(game: Game, fb: SlotFeedback): string | null {
  if (fb.kind === 'noFreeSlot')
    return fill(t.errors.noFreeSlot, { max: game.rules.maxKeysPerAction })
  if (fb.kind !== 'error') return null
  if (fb.error.kind === 'blockedKey') return fill(t.errors.blockedKey, { game: game.name })
  return fill(t.errors.modifierNotAllowed, {
    mods: fb.error.modifiers.map(modifierName).join(', '),
  })
}

/** Предупреждение о конфликте под кнопкой: список и «Оставить» / «Снять» (FR-12, шаг 4) */
function ConflictWarning({
  game,
  profile,
  bindingId,
}: {
  game: Game
  profile: Profile
  bindingId: string
}) {
  const others = conflictsWith(game, profile, bindingId)
  const names = new Map(game.actions.map((a) => [a.id, a.name]))
  if (others.length === 0) return null
  return (
    <div
      role="alert"
      className="grid gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
    >
      <p className="font-medium text-destructive">{t.conflictWith}</p>
      <ul className="grid gap-0.5">
        {others.map((b) => (
          <li key={b.id}>
            {names.get(b.actionId)} — {comboName(b.input)}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => {
            setFeedback(null)
          }}
        >
          {t.keep}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7"
          onClick={() => {
            unbindOthersCmd(bindingId)
          }}
        >
          {t.unbindOthers}
        </Button>
      </div>
    </div>
  )
}

/** Подсказка захвата: что назначит клик по экранной клавише в текущем слое */
function CaptureHint() {
  const layer = useBindingsUi((s) => s.layer)
  return (
    <p className="text-xs text-sky-700 dark:text-sky-400">
      {t.captureHint}
      {layer !== BASE_LAYER && (
        <>
          <br />
          {fill(t.clickWill, { combo: `${layerName(layer)}+…` })}
        </>
      )}
    </p>
  )
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
}

/**
 * Строка действия (FR-12): название, метка категории, контекст, кнопки
 * клавиш, тип нажатия и параметр; под кнопками — захват, ошибка правил,
 * конфликт и нарушения.
 */
export function ActionRow({
  game,
  profile,
  action,
  emptyLabel,
  onHover,
  onPick,
  picked = false,
}: ActionRowProps) {
  const issues = useCurrentIssues()
  const capture = useBindingsUi((s) => (s.capture?.actionId === action.id ? s.capture : null))
  const feedback = useBindingsUi((s) => (s.feedback?.actionId === action.id ? s.feedback : null))
  const category = game.categories.find((c) => c.id === action.categoryId)
  const context = game.contexts.find((c) => c.id === action.contextId)
  const slots = slotsOf(game, profile, action.id)
  const bindings = bindingsOfAction(profile, action.id)
  const violations = bindings.flatMap((b) => violationsOf(issues, b.id))
  const error = feedback && feedbackError(game, feedback)

  return (
    <div
      role="group"
      aria-label={action.name}
      data-action-id={action.id}
      data-picked={picked || undefined}
      className={cn(
        'grid gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted/60',
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
        <span
          className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
          style={category ? { background: category.color } : undefined}
          aria-hidden="true"
        />
        <div className="grid min-w-0 flex-1">
          <span
            className="truncate text-sm"
            title={action.nameEn ? `${action.name} (${action.nameEn})` : action.name}
          >
            {action.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[category?.name ?? ru.panel.uncategorized, context?.name].filter(Boolean).join(' · ')}
          </span>
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
      {capture && <CaptureHint />}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {feedback?.kind === 'conflict' && bindingInSlot(profile, action.id, feedback.slot) && (
        <ConflictWarning game={game} profile={profile} bindingId={feedback.bindingId} />
      )}
      {violations.map((v) => (
        <p key={`${v.kind}-${v.binding.id}`} className="text-xs text-destructive">
          {comboName(v.binding.input)}: {violationText(v)}
        </p>
      ))}
    </div>
  )
}
