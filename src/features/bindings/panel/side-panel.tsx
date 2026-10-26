import { Activity, useDeferredValue, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { settingSections } from '@/domain/settings-template'
import type { Game } from '@/domain/types'
import { cn } from '@/lib/utils'
import { BindDialog } from '@/features/bindings/bind-dialog'
import { useDevicesStore } from '@/features/devices/store'
import { useCurrentGame, useCurrentProfile } from '@/features/games/use-current'
import { ru } from '@/i18n/ru'
import { resetBindingsUi, setPanelTab, useBindingsUi, type PanelTab } from '../ui-store'
import { ActionList, UnboundList } from './action-list'
import { GroupsTab } from './groups-tab'
import { NotesTab } from './notes-tab'
import { SelectionView } from './selection-view'
import { ValuesTab } from './values-tab'

/** Ширина панели (FR-13, раздел 8.4) */
const MIN_WIDTH = 320
const MAX_WIDTH = 900
const WIDTH_KEY = 'hotkey-map:panel-width'

const TABS: readonly PanelTab[] = ['actions', 'unbound', 'groups', 'settings', 'notes']

/** Ширина — удобство одного браузера, в данные не попадает; хранилище может быть недоступно */
function savedWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH ? n : MIN_WIDTH + 40
  } catch {
    return MIN_WIDTH + 40
  }
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(width))
  } catch {
    // Без localStorage ширина просто не запомнится
  }
}

/** Граница панели: перетаскивание меняет ширину */
function ResizeHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const drag = useRef<{ x: number; width: number } | null>(null)
  const clamp = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)))
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ru.panel.resize}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize outline-none hover:bg-sky-500/30 focus-visible:bg-sky-500/40"
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        drag.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        // Панель справа: тянем влево — шире
        if (drag.current) onChange(clamp(drag.current.width + drag.current.x - e.clientX))
      }}
      onPointerUp={(e) => {
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange(clamp(width + 16))
        if (e.key === 'ArrowRight') onChange(clamp(width - 16))
      }}
    />
  )
}

/** Показать раздел: вкладка, затем прокрутка к нему, когда он отрисован */
function goToSection(tab: PanelTab, elementId: string | null): void {
  useDevicesStore.getState().clearSelection()
  setPanelTab(tab)
  if (!elementId) return
  requestAnimationFrame(() => {
    document.getElementById(elementId)?.scrollIntoView({ block: 'start' })
  })
}

/**
 * Боковое меню окна настроек, как в Dota 2: «Управление» — категории
 * действий, «Игра» — группы настроек, затем остальные вкладки.
 */
function PanelNav({ game, tab }: { game: Game; tab: PanelTab }) {
  const groups = settingSections(game).map((s) => s.group)
  const item = (label: string, active: boolean, onClick: () => void, key: string) => (
    <li key={key}>
      <button
        type="button"
        aria-current={active || undefined}
        className={cn(
          'w-full truncate rounded-md px-3 py-1 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
          active && 'bg-muted text-foreground',
        )}
        onClick={onClick}
      >
        {label}
      </button>
    </li>
  )
  const heading = (label: string) => (
    <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wider uppercase">{label}</p>
  )
  return (
    <nav aria-label={ru.panel.nav} className="w-56 shrink-0 overflow-y-auto border-r p-2">
      {heading(ru.panel.navControls)}
      <ul>
        {game.categories.map((c) =>
          item(
            c.name,
            false,
            () => {
              goToSection('actions', `section-${c.id}`)
            },
            c.id,
          ),
        )}
      </ul>
      {groups.length > 0 && heading(ru.panel.navGame)}
      <ul>
        {groups.map((g) =>
          item(
            g,
            false,
            () => {
              goToSection('settings', `settings-${g}`)
            },
            g,
          ),
        )}
      </ul>
      <ul className="mt-3 border-t pt-2">
        {(['unbound', 'groups', 'notes'] as const).map((t) =>
          item(
            ru.panel.tabs[t],
            tab === t,
            () => {
              goToSection(t, null)
            },
            t,
          ),
        )}
      </ul>
    </nav>
  )
}

/**
 * Панель справа (раздел 8.1): «Действия» — выделенные клавиши или список
 * действий с поиском; «Без клавиши», «Группы», «Настройки», «Заметки».
 * wide — клавиатура и мышь скрыты: панель — окно по центру с боковым меню.
 */
export function SidePanel({ wide = false }: { wide?: boolean }) {
  const game = useCurrentGame()
  const profile = useCurrentProfile()
  const tab = useBindingsUi((s) => s.tab)
  // Панель отстаёт от клавиатуры: клавиши подсвечиваются в том же кадре, а
  // панель дорисовывается следом в прерываемом рендере (FR-13, NFR-02)
  const selected = useDeferredValue(useDevicesStore((s) => s.selection.selected))
  const hasSelection = selected.length > 0
  const [width, setWidth] = useState(savedWidth)

  // Захват, отклик и подсветка относятся к действиям прежней игры или профиля
  useEffect(() => {
    resetBindingsUi()
  }, [game?.id, profile?.id])

  // Выделение показывает действия клавиш; с «Групп» не уводит — там добавляют выделенные
  useEffect(() => {
    if (!hasSelection) return
    const current = useBindingsUi.getState().tab
    if (current !== 'actions' && current !== 'groups') setPanelTab('actions')
  }, [hasSelection])

  if (!game || !profile) return null

  return (
    <aside
      aria-label={ru.panel.label}
      data-testid="side-panel"
      data-wide={wide || undefined}
      className={cn(
        'relative flex bg-background',
        wide
          ? 'mx-auto my-4 w-full max-w-[1100px] overflow-hidden rounded-lg border shadow-sm'
          : 'shrink-0 flex-col border-l',
      )}
      style={wide ? undefined : { width }}
    >
      {/* Окно привязки — слева от панели, поверх сцены: клавиатура остаётся видна */}
      <BindDialog
        className={
          wide ? 'fixed top-24 left-1/2 -translate-x-1/2' : 'absolute top-14 right-full mr-3'
        }
      />
      {wide ? (
        <PanelNav game={game} tab={tab} />
      ) : (
        <ResizeHandle
          width={width}
          onChange={(w) => {
            setWidth(w)
            saveWidth(w)
          }}
        />
      )}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = TABS.find((t) => t === v)
          if (next) setPanelTab(next)
        }}
        className="min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          className={cn(
            'm-2 mb-0 grid h-auto grid-cols-[repeat(5,auto)] justify-stretch',
            wide && 'hidden',
          )}
        >
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="justify-center px-1 py-1 text-xs">
              {ru.panel.tabs[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="@container min-h-0 flex-1 overflow-y-auto p-2">
          <TabsContent value="actions">
            {hasSelection && <SelectionView game={game} profile={profile} selected={selected} />}
            {/* Список действий при выделении только прячется: снятие выделения
                показывает готовый список, а не строит сотни строк заново (NFR-02) */}
            <Activity mode={hasSelection ? 'hidden' : 'visible'}>
              <ActionList key={profile.id} game={game} profile={profile} />
            </Activity>
          </TabsContent>
          <TabsContent value="unbound">
            <UnboundList game={game} profile={profile} />
          </TabsContent>
          <TabsContent value="groups">
            <GroupsTab game={game} profile={profile} />
          </TabsContent>
          <TabsContent value="settings">
            <ValuesTab game={game} profile={profile} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesTab key={profile.id} game={game} profile={profile} />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}
