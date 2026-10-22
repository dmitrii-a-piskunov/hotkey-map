import type { Game } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useIconUrl } from './icon-cache'

/** Иконка игры; без картинки — первая буква названия (FR-05) */
export function GameIcon({
  game,
  className,
}: {
  game: Pick<Game, 'name' | 'icon'>
  className?: string
}) {
  const url = useIconUrl(game.icon)
  const box = cn('inline-flex size-6 shrink-0 overflow-hidden rounded', className)
  if (url) return <img src={url} alt="" className={cn(box, 'object-cover')} draggable={false} />
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        'items-center justify-center bg-muted text-xs font-semibold text-muted-foreground uppercase',
      )}
    >
      {game.name.trim().charAt(0)}
    </span>
  )
}
