import { Download, ImageUp, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { SteamVariant } from '@/domain/icons'
import type { Game } from '@/domain/types'
import { usePersistence } from '@/features/persistence/persistence-context'
import type { PersistenceSession } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'
import { fillSteamAppIdCmd, setGameIconCmd } from '../commands'
import { GameIcon } from '../game-icon'
import { saveGameIcon } from '../icon-cache'
import {
  droppedFile,
  iconFromAnyFile,
  IconImageError,
  steamPreviews,
  type SteamPreview,
} from '../icon-image'

const t = ru.editor.general

const ERRORS = {
  type: t.iconType,
  size: t.iconSize,
  decode: t.iconDecode,
  shortcut: t.iconShortcut,
  steam: t.steamFailed,
} as const

interface PreviewUrl extends SteamPreview {
  url: string
}

/**
 * Картинка или ярлык Steam → PNG 128×128 в icons/; ответ — текст ошибки или
 * null. AppID из ярлыка записывается игре, если его ещё нет.
 */
async function saveFromFile(
  session: PersistenceSession,
  gameId: string,
  file: File,
): Promise<string | null> {
  try {
    const { png, appId } = await iconFromAnyFile(file)
    await saveGameIcon(session, gameId, png)
    if (appId !== undefined) fillSteamAppIdCmd(gameId, appId)
    return null
  } catch (e) {
    if (e instanceof IconImageError) return ERRORS[e.reason]
    console.error('Saving icon failed', e)
    return t.iconDecode
  }
}

/**
 * Иконка игры (FR-05): перетащить картинку или ярлык игры Steam, вставить
 * из буфера (Ctrl+V, пока открыта вкладка), выбрать файл или загрузить из
 * Steam по AppID с выбором варианта кликом.
 */
export function IconField({ game, steamAppId }: { game: Game; steamAppId: number | undefined }) {
  const session = usePersistence()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [steam, setSteam] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [previews, setPreviews] = useState<PreviewUrl[]>([])

  useEffect(
    () => () => {
      previews.forEach((p) => {
        URL.revokeObjectURL(p.url)
      })
    },
    [previews],
  )

  async function applyFile(file: File | null) {
    if (!file) return
    setError(null)
    setError(await saveFromFile(session, game.id, file))
  }

  // Ctrl+V в диалоге: картинка из буфера обмена
  const gameId = game.id
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = droppedFile(e.clipboardData)
      if (!file) return
      e.preventDefault()
      setError(null)
      void saveFromFile(session, gameId, file).then(setError)
    }
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('paste', onPaste)
    }
  }, [session, gameId])

  async function loadSteam() {
    if (steamAppId === undefined) return
    setSteam('loading')
    setPreviews([])
    const list = await steamPreviews(steamAppId)
    if (list.length === 0) {
      setSteam('failed')
      return
    }
    setSteam('idle')
    setPreviews(list.map((p) => ({ ...p, url: URL.createObjectURL(p.png) })))
  }

  async function chooseSteam(preview: PreviewUrl) {
    setError(null)
    try {
      await saveGameIcon(session, game.id, preview.png)
      setPreviews([])
    } catch (e) {
      console.error('Saving icon failed', e)
      setError(t.iconDecode)
    }
  }

  return (
    <div className="grid gap-3">
      <div
        data-testid="icon-drop"
        className={cn(
          'flex items-center gap-4 rounded-md border border-dashed p-3',
          dragOver && 'border-ring bg-accent',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => {
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void applyFile(droppedFile(e.dataTransfer))
        }}
      >
        <GameIcon game={game} className="size-16 text-2xl" />
        <div className="grid flex-1 gap-1 text-sm">
          <span>{t.iconDrop}</span>
          <span className="text-xs text-muted-foreground">{t.iconFormats}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp />
              {t.chooseFile}
            </Button>
            {game.icon && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setGameIconCmd(game.id, undefined)
                }}
              >
                <X />
                {t.removeIcon}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={steamAppId === undefined || steam === 'loading'}
              onClick={() => void loadSteam()}
            >
              {steam === 'loading' ? <Loader2 className="animate-spin" /> : <Download />}
              {steam === 'loading' ? t.steamLoading : t.steamLoad}
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/x-icon,.ico,.url"
          className="hidden"
          data-testid="icon-file"
          onChange={(e) => {
            void applyFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {steam === 'failed' && <p className="text-xs text-destructive">{t.steamFailed}</p>}
      {previews.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm">{t.steamChoose}</span>
          <div className="flex gap-3">
            {previews.map((p) => (
              <button
                key={p.variant}
                type="button"
                className="grid justify-items-center gap-1 rounded-md border p-2 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => void chooseSteam(p)}
              >
                <img src={p.url} alt="" className="size-16 rounded" />
                {t.steamVariants[p.variant satisfies SteamVariant]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
