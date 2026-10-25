import { Ellipsis, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { bindingInSlot, defaultParamOptionId, PRESS_TYPES } from '@/domain/bindings'
import type { Action, Binding, Game, Profile } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { setBindingParamCmd, setPressTypeCmd, unassignCmd } from '../commands'
import { comboName, pressTypeName } from '../format'
import { cancelCapture, startCapture, useBindingsUi } from '../ui-store'
import { useCurrentIssues } from '../use-bindings'

const t = ru.bindings

/** Меню типа нажатия и параметра бинда (FR-09, FR-12) */
export function BindingOptionsMenu({
  game,
  binding,
  children,
}: {
  game: Game
  binding: Binding
  children: ReactNode
}) {
  const param = game.bindParam
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t.pressType}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={binding.pressType}
          onValueChange={(v) => {
            const type = PRESS_TYPES.find((p) => p === v)
            if (type) setPressTypeCmd(binding.id, type)
          }}
        >
          {PRESS_TYPES.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {pressTypeName(p)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {param && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{param.name}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={binding.paramOptionId ?? defaultParamOptionId(game) ?? ''}
              onValueChange={(v) => {
                // Значение по умолчанию не храним: так бинд остаётся «обычным»
                setBindingParamCmd(binding.id, v === defaultParamOptionId(game) ? undefined : v)
              }}
            >
              {param.options.map((o) => (
                <DropdownMenuRadioItem key={o.id} value={o.id}>
                  {o.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SlotButtonProps {
  game: Game
  profile: Profile
  action: Action
  slot: 1 | 2
  /** Надпись пустой кнопки: «—» или «Назначить клавишу» (FR-17) */
  emptyLabel?: string
}

/**
 * Кнопка клавиши (FR-12): клик — режим «Нажмите клавишу…», крестик снимает
 * бинд, «⋯» — тип нажатия и параметр.
 */
export function SlotButton({ game, profile, action, slot, emptyLabel }: SlotButtonProps) {
  const binding = bindingInSlot(profile, action.id, slot)
  const capturing = useBindingsUi(
    (s) => s.capture?.actionId === action.id && s.capture.slot === slot,
  )
  const issues = useCurrentIssues()
  const bad = binding !== undefined && issues.bindingIds.has(binding.id)
  const combo = binding ? comboName(binding.input) : null
  const ref = { actionId: action.id, slot }

  return (
    <div
      className={cn(
        'flex h-7 min-w-0 items-center rounded-md border bg-background text-sm shadow-xs',
        capturing && 'border-sky-500 ring-2 ring-sky-500/40',
        bad && !capturing && 'border-destructive',
      )}
    >
      <button
        type="button"
        data-capture-slot
        aria-pressed={capturing}
        aria-label={
          combo
            ? fill(t.keyButton, { slot, action: action.name, combo })
            : fill(t.keyButtonEmpty, { slot, action: action.name })
        }
        title={combo ?? undefined}
        className={cn(
          'h-full min-w-12 truncate px-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          !combo && !capturing && 'text-muted-foreground',
          capturing && 'text-sky-600 dark:text-sky-400',
          bad && !capturing && 'text-destructive',
        )}
        onClick={() => {
          if (capturing) cancelCapture()
          else startCapture(ref)
        }}
      >
        {combo ?? emptyLabel ?? t.notAssigned}
      </button>
      {binding && (
        <>
          <BindingOptionsMenu game={game} binding={binding}>
            <button
              type="button"
              aria-label={`${t.options}: ${combo ?? ''}`}
              title={t.options}
              className="flex h-full w-5 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Ellipsis className="size-3.5" />
            </button>
          </BindingOptionsMenu>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            aria-label={`${t.unbind}: ${combo ?? ''}`}
            title={t.unbind}
            onClick={() => {
              unassignCmd(ref)
            }}
          >
            <X className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}
