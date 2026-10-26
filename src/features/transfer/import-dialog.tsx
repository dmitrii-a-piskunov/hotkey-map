import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/input'
import type { GamePreview, ImportReport, ImportStrategy } from '@/domain/merge'
import { usePersistence } from '@/features/persistence/persistence-context'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  closeImport,
  confirmImport,
  setGameStrategy,
  setProfileStrategy,
  useImport,
} from './import'

const t = ru.import

/** Сколько ошибок показывать списком (FR-21) */
const MAX_ISSUES = 20

const STRATEGIES: readonly ImportStrategy[] = ['merge', 'copy', 'replace']

function StrategySelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: ImportStrategy
  onChange: (value: ImportStrategy) => void
}) {
  return (
    <NativeSelect
      aria-label={label}
      title={t.strategyHints[value]}
      className="h-8 w-40 shrink-0 text-sm"
      value={value}
      onChange={(e) => {
        const next = STRATEGIES.find((s) => s === e.target.value)
        if (next) onChange(next)
      }}
    >
      {STRATEGIES.map((s) => (
        <option key={s} value={s}>
          {t.strategies[s]}
        </option>
      ))}
    </NativeSelect>
  )
}

function Tag({ matched, children }: { matched: boolean; children: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
        matched ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </span>
  )
}

function GameRow({ game }: { game: GamePreview }) {
  const choice = useImport((s) => (s.phase === 'preview' ? s.choices[game.id] : undefined))
  const strategy = choice?.strategy ?? 'merge'
  const showProfiles = game.match === null || strategy === 'merge'

  return (
    <li className="grid gap-2 rounded-md border p-3" data-testid="import-game">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{game.name}</div>
          <div className="text-xs text-muted-foreground">
            {fill(t.actionsStats, { added: game.actionsNew, matched: game.actionsMatched })}
          </div>
        </div>
        <Tag matched={game.match !== null}>
          {game.match ? fill(t.gameMatches, { name: game.match.name }) : t.newGame}
        </Tag>
        {game.match && (
          <StrategySelect
            label={fill(t.gameStrategy, { name: game.name })}
            value={strategy}
            onChange={(s) => {
              setGameStrategy(game.id, s)
            }}
          />
        )}
      </div>
      {showProfiles && game.profiles.length > 0 && (
        <ul className="grid gap-1 border-l-2 pl-3" aria-label={t.profilesTitle}>
          {game.profiles.map((p) => (
            <li key={p.id} className="flex min-h-8 items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <Tag matched={p.match !== null}>{p.match ? t.profileMatches : t.newProfile}</Tag>
              {p.match && (
                <StrategySelect
                  label={fill(t.profileStrategy, { name: p.name })}
                  value={choice?.profiles[p.id] ?? 'merge'}
                  onChange={(s) => {
                    setProfileStrategy(game.id, p.id, s)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function reportLines(report: ImportReport): string[] {
  const keys = Object.keys(t.report) as (keyof ImportReport)[]
  return keys.filter((k) => report[k] > 0).map((k) => fill(t.report[k], { count: report[k] }))
}

function ImportBody() {
  const session = usePersistence()
  const state = useImport()

  switch (state.phase) {
    case 'idle':
      return null
    case 'reading':
      return (
        <DialogHeader>
          <DialogTitle>{t.previewTitle}</DialogTitle>
          <DialogDescription>{t.reading}</DialogDescription>
        </DialogHeader>
      )
    case 'errors': {
      const shown = state.issues.slice(0, MAX_ISSUES)
      const rest = state.issues.length - shown.length
      return (
        <>
          <DialogHeader>
            <DialogTitle>{t.errorsTitle}</DialogTitle>
            <DialogDescription>
              {state.fileName} · {t.errorsText}
            </DialogDescription>
          </DialogHeader>
          <ul role="alert" className="grid gap-1 text-sm" data-testid="import-errors">
            {shown.map((issue, i) => (
              <li key={i} className="rounded-md bg-destructive/10 px-3 py-1.5 text-destructive">
                {issue.place !== '' && <span className="font-medium">{issue.place}: </span>}
                {issue.message}
              </li>
            ))}
            {rest > 0 && (
              <li className="px-3 text-muted-foreground">{fill(t.more, { count: rest })}</li>
            )}
          </ul>
          <DialogFooter>
            <Button onClick={closeImport}>{ru.common.close}</Button>
          </DialogFooter>
        </>
      )
    }
    case 'preview':
      return (
        <>
          <DialogHeader>
            <DialogTitle>
              {t.previewTitle}: {state.fileName}
            </DialogTitle>
            <DialogDescription>{t.previewText}</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2">
            {state.preview.games.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
          {state.preview.appSettings && (
            <p className="text-sm text-muted-foreground">{t.appSettings}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeImport}>
              {ru.common.cancel}
            </Button>
            <Button disabled={state.busy} onClick={() => void confirmImport(session)}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </>
      )
    case 'done': {
      const lines = reportLines(state.report)
      return (
        <>
          <DialogHeader>
            <DialogTitle>{t.doneTitle}</DialogTitle>
            <DialogDescription>{state.fileName}</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1 text-sm" data-testid="import-report">
            {(lines.length > 0 ? lines : [t.nothingChanged]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={closeImport}>{ru.common.close}</Button>
          </DialogFooter>
        </>
      )
    }
  }
}

/** Импорт (FR-21): ошибки, предпросмотр со стратегиями, итог */
export function ImportDialog() {
  const open = useImport((s) => s.phase !== 'idle')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeImport()
      }}
    >
      <DialogContent closeLabel={ru.common.close} className="max-w-2xl">
        <ImportBody />
      </DialogContent>
    </Dialog>
  )
}
