import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Game } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { GameIcon } from '../game-icon'
import { closeEditor, setEditorTab, useGamesUi, type EditorTab } from '../ui-store'
import { useGame } from '../use-current'
import { ActionsTab } from './actions-tab'
import { BindParamTab } from './bind-param-tab'
import { CategoriesTab } from './categories-tab'
import { ContextsTab } from './contexts-tab'
import { GeneralTab } from './general-tab'
import { SettingsTab } from './settings-tab'

const TABS: readonly { value: EditorTab; Panel: (props: { game: Game }) => React.ReactNode }[] = [
  { value: 'general', Panel: GeneralTab },
  { value: 'contexts', Panel: ContextsTab },
  { value: 'categories', Panel: CategoriesTab },
  { value: 'actions', Panel: ActionsTab },
  { value: 'bindParam', Panel: BindParamTab },
  { value: 'settings', Panel: SettingsTab },
]

function isTab(value: string): value is EditorTab {
  return TABS.some((tab) => tab.value === value)
}

/** Редактор игры: справочники в шести вкладках (раздел 8.2) */
export function GameEditor() {
  const editor = useGamesUi((s) => s.editor)
  const game = useGame(editor?.gameId)
  const open = editor !== null && game !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeEditor()
      }}
    >
      <DialogContent
        closeLabel={ru.common.close}
        className="flex h-[85vh] max-w-5xl flex-col gap-4 overflow-hidden sm:max-w-5xl"
        onEscapeKeyDown={(e) => {
          // Правка названия на месте сама обрабатывает Esc: отменяет правку
          if (e.target instanceof Element && e.target.closest('[data-escape-local]')) {
            e.preventDefault()
          }
        }}
      >
        {open && (
          <>
            <DialogHeader className="flex-row items-center gap-3 pr-8">
              <GameIcon game={game} className="size-8" />
              <div className="grid gap-1">
                <DialogTitle className="truncate">{game.name}</DialogTitle>
                <DialogDescription>{ru.editor.title}</DialogDescription>
              </div>
            </DialogHeader>
            <Tabs
              orientation="vertical"
              value={editor.tab}
              onValueChange={(v) => {
                if (isTab(v)) setEditorTab(v)
              }}
              className="min-h-0 flex-1"
            >
              <TabsList className="h-fit w-48 shrink-0 flex-col items-stretch">
                {TABS.map(({ value }) => (
                  <TabsTrigger key={value} value={value}>
                    {ru.editor.tabs[value]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map(({ value, Panel }) => (
                <TabsContent key={value} value={value} className="overflow-y-auto pr-2 pb-2">
                  <Panel key={game.id} game={game} />
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
