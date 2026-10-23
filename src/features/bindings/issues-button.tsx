import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Binding } from '@/domain/types'
import { layerOf } from '@/domain/layers'
import { useDevicesStore } from '@/features/devices/store'
import { useCurrentGame } from '@/features/games/use-current'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { cn } from '@/lib/utils'
import { comboName, pressTypeName, violationText } from './format'
import { setHighlight, setLayer, setPanelTab } from './ui-store'
import { useCurrentIssues } from './use-bindings'

const t = ru.bindings

/** Переход к клавише бинда: её слой, выделение и панель «Действия» */
function goTo(binding: Binding): void {
  setLayer(layerOf(binding))
  setHighlight(null)
  setPanelTab('actions')
  useDevicesStore.getState().selectOnly(binding.input.code)
}

/**
 * Счётчик конфликтов и нарушений в шапке (FR-15): клик показывает список,
 * пункт списка ведёт к клавише.
 */
export function IssuesButton() {
  const game = useCurrentGame()
  const issues = useCurrentIssues()
  const [open, setOpen] = useState(false)
  if (!game) return null
  const names = new Map(game.actions.map((a) => [a.id, a.name]))
  const count = issues.count

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="issues-button"
          // Шапка тесная: значок и число, полный текст — в подписи
          aria-label={count > 0 ? fill(t.issuesButton, { count }) : t.noIssues}
          title={count > 0 ? fill(t.issuesButton, { count }) : t.noIssues}
          className={cn(
            'gap-1 tabular-nums',
            count > 0 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {count > 0 ? <TriangleAlert /> : <CircleCheck />}
          {count}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-2" aria-label={t.issuesTitle}>
        <p className="px-2 pb-1 text-sm font-semibold">{t.issuesTitle}</p>
        {count === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">{t.noIssues}</p>
        ) : (
          <ul className="grid max-h-96 gap-0.5 overflow-y-auto">
            {issues.conflicts.map((c) => {
              const first = c.bindings[0]
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    title={t.goToKey}
                    className="grid w-full gap-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                    onClick={() => {
                      if (first) goTo(first)
                      setOpen(false)
                    }}
                  >
                    <span className="text-sm font-medium text-destructive">
                      {fill(t.conflictItem, {
                        combo: comboName(c.input),
                        pressType: pressTypeName(c.pressType),
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.bindings.map((b) => names.get(b.actionId)).join(', ')}
                    </span>
                  </button>
                </li>
              )
            })}
            {issues.violations.map((v) => (
              <li key={`${v.kind}-${v.binding.id}`}>
                <button
                  type="button"
                  title={t.goToKey}
                  className="grid w-full gap-0.5 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    goTo(v.binding)
                    setOpen(false)
                  }}
                >
                  <span className="text-sm font-medium text-destructive">
                    {comboName(v.binding.input)}: {violationText(v)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {names.get(v.binding.actionId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
