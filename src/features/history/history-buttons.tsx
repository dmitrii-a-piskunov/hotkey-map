import { Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ru } from '@/i18n/ru'
import { redoCmd, undoCmd, useCanRedo, useCanUndo } from './history'

const t = ru.history

/** «Отменить» и «Повторить» в шапке (FR-24) */
export function HistoryButtons() {
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  return (
    <div className="flex items-center gap-0.5 border-l pl-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.undo}
        title={t.undoHint}
        disabled={!canUndo}
        onClick={undoCmd}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.redo}
        title={t.redoHint}
        disabled={!canRedo}
        onClick={redoCmd}
      >
        <Redo2 />
      </Button>
    </div>
  )
}
