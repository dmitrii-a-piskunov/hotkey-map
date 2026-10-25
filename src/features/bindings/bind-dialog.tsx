import { X } from 'lucide-react'
import { useEffect, useRef, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { bindingInSlot, captureError } from '@/domain/bindings'
import { conflictsForInput } from '@/domain/conflicts'
import { heldModifiers, mouseCodeForButton, mouseCodeForWheel } from '@/domain/input'
import { BASE_LAYER } from '@/domain/layers'
import type { Game, Profile } from '@/domain/types'
import { mouseLayout } from '@/features/devices/devices'
import { useCurrentGame, useCurrentProfile } from '@/features/games/use-current'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { captureInputCmd, confirmCaptureCmd } from './commands'
import { comboName, layerName, modifierName } from './format'
import { cancelCapture, setPending, useBindingsUi, type Capture } from './ui-store'

const t = ru.bindings

/**
 * Поле захвата: здесь ловится любая кнопка мыши (ЛКМ, ПКМ, колесо, Mouse 4/5)
 * и прокрутка. Клавиши ловит общий обработчик клавиатуры.
 */
function CaptureBox({ text, empty }: { text: string; empty: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Прокрутка над полем — колесо вверх/вниз; страница не прокручивается
    function onWheel(e: WheelEvent) {
      const code = mouseCodeForWheel(mouseLayout, e.deltaY)
      if (!code) return
      e.preventDefault()
      captureInputCmd(code, heldModifiers(e))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div
      ref={ref}
      data-testid="capture-box"
      aria-live="polite"
      className={cn(
        'flex h-20 min-w-24 items-center justify-center rounded-md border-2 border-sky-500 bg-muted/40 px-4 text-2xl font-semibold shadow-[0_0_12px] shadow-sky-500/40 select-none',
        empty && 'text-muted-foreground',
      )}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.preventDefault()
        const code = mouseCodeForButton(mouseLayout, e.button)
        if (code) captureInputCmd(code, heldModifiers(e))
      }}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    >
      {text}
    </div>
  )
}

function DialogBody({
  game,
  profile,
  capture,
}: {
  game: Game
  profile: Profile
  capture: Capture
}) {
  const layer = useBindingsUi((s) => s.layer)
  const action = game.actions.find((a) => a.id === capture.actionId)
  if (!action) return null
  const own = bindingInSlot(profile, capture.actionId, capture.slot)
  const { pending } = capture
  const shown = pending === undefined ? own?.input : pending
  const error = pending ? captureError(game, pending) : null
  const conflicts =
    pending && !error
      ? conflictsForInput(game, profile, capture, pending, own?.pressType ?? 'press')
      : []
  const names = conflicts.map((b) => game.actions.find((a) => a.id === b.actionId)?.name ?? '')
  const twoSlots = game.rules.maxKeysPerAction === 2

  let errorText: string | null = null
  if (error?.kind === 'blockedKey') errorText = fill(t.errors.blockedKey, { game: game.name })
  if (error?.kind === 'modifierNotAllowed') {
    errorText = fill(t.errors.modifierNotAllowed, {
      mods: error.modifiers.map(modifierName).join(', '),
    })
  }

  return (
    <div className="grid justify-items-center gap-3 p-4 pt-2 text-center">
      <p className="text-base font-medium">
        {action.name}
        {twoSlots && (
          <span className="text-sm font-normal text-muted-foreground">
            {' '}
            · {fill(t.slot, { slot: capture.slot })}
          </span>
        )}
      </p>
      <CaptureBox text={shown ? comboName(shown) : t.notAssigned} empty={!shown} />
      <p className="text-xs text-muted-foreground">
        {t.boxHint}
        {layer !== BASE_LAYER && (
          <>
            <br />
            {fill(t.clickWill, { combo: `${layerName(layer)}+…` })}
          </>
        )}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={!shown}
        onClick={() => {
          setPending(null)
        }}
      >
        {t.clear}
      </Button>
      <div className="h-px w-full bg-border" />
      {errorText && (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      )}
      {conflicts.length > 0 && (
        <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
          {t.alreadyBound} {names.map((n) => `«${n}»`).join(', ')}
        </p>
      )}
      {conflicts.length > 0 ? (
        <div className="grid w-full gap-2">
          <Button
            onClick={() => {
              confirmCaptureCmd('keep')
            }}
          >
            {t.confirmAnyway}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              confirmCaptureCmd('unbindOthers')
            }}
          >
            {t.confirmReplace}
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={errorText !== null}
          onClick={() => {
            confirmCaptureCmd('keep')
          }}
        >
          {t.confirm}
        </Button>
      )}
    </div>
  )
}

/**
 * Окно «Привязка клавиши» (FR-12), как в Dota 2: нажатая клавиша или кнопка
 * мыши видна в поле, сохраняет «Подтвердить». Окно не модальное: клик по
 * экранной клавише тоже назначает её.
 */
export function BindDialog({ className }: { className?: string }) {
  const capture = useBindingsUi((s) => s.capture)
  const game = useCurrentGame()
  const profile = useCurrentProfile()
  if (!capture || !game || !profile) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.dialogTitle}
      data-bind-dialog
      className={cn(
        'z-30 w-80 rounded-lg border bg-popover text-popover-foreground shadow-xl',
        className,
      )}
    >
      <div className="flex items-center border-b py-1.5 pr-1.5 pl-4">
        <h2 className="flex-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t.dialogTitle}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={ru.common.close}
          onClick={cancelCapture}
        >
          <X />
        </Button>
      </div>
      <DialogBody game={game} profile={profile} capture={capture} />
    </div>
  )
}
