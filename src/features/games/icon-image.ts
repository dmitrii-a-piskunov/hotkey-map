/**
 * Подготовка иконки (FR-05, раздел 12): картинка декодируется браузером и
 * перерисовывается на canvas в PNG 128×128. Так из файла уходит всё, кроме
 * пикселей, а SVG отсекается ещё до чтения.
 */

import {
  drawPlan,
  ICON_SIZE,
  iconFileError,
  isShortcutFile,
  parseSteamShortcut,
  SHORTCUT_MAX_BYTES,
  steamClientIconUrl,
  STEAM_VARIANTS,
  steamImageUrl,
  type SteamVariant,
} from '@/domain/icons'

/** shortcut — ярлык не от игры Steam, steam — Steam не отдал иконку */
export type IconError = 'type' | 'size' | 'decode' | 'shortcut' | 'steam'

export class IconImageError extends Error {
  readonly reason: IconError

  constructor(reason: IconError) {
    super(reason)
    this.name = 'IconImageError'
    this.reason = reason
  }
}

/** Фон под логотипом Steam: логотипы белые или светлые, им нужен тёмный фон */
const LOGO_BACKGROUND = '#1b2838'
const LOGO_PADDING = 10

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      reject(new IconImageError('decode'))
    }
    img.src = url
  }).finally(() => {
    URL.revokeObjectURL(url)
  })
}

async function render(
  blob: Blob,
  fit: 'center' | 'top' | 'contain',
  background?: string,
): Promise<Blob> {
  const img = await loadImage(blob)
  if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new IconImageError('decode')
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new IconImageError('decode')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE)
  }
  const p = drawPlan(
    img.naturalWidth,
    img.naturalHeight,
    fit,
    ICON_SIZE,
    fit === 'contain' ? LOGO_PADDING : 0,
  )
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh)
  return new Promise((resolve, reject) => {
    canvas.toBlob((png) => {
      if (png) resolve(png)
      else reject(new IconImageError('decode'))
    }, 'image/png')
  })
}

/** Картинка, перетащенная, вставленная или выбранная вручную: квадрат из центра */
export async function iconFromFile(file: File): Promise<Blob> {
  const error = iconFileError(file)
  if (error) throw new IconImageError(error)
  return render(file, 'center')
}

export interface SteamPreview {
  variant: SteamVariant
  png: Blob
}

const STEAM_FIT: Record<SteamVariant, 'center' | 'top' | 'contain'> = {
  header: 'center',
  library: 'top',
  logo: 'contain',
}

async function steamVariant(appId: number, variant: SteamVariant): Promise<SteamPreview> {
  const response = await fetch(steamImageUrl(appId, variant), { mode: 'cors' })
  if (!response.ok) throw new Error(`Steam ${variant}: ${response.status}`)
  const blob = await response.blob()
  const png = await render(
    blob,
    STEAM_FIT[variant],
    variant === 'logo' ? LOGO_BACKGROUND : undefined,
  )
  return { variant, png }
}

/**
 * Варианты иконки из Steam CDN (раздел 10.1): центр header.jpg, верх
 * library_600x900.jpg и logo.png на тёмном фоне. Недоступные пропускаются.
 */
export async function steamPreviews(appId: number): Promise<SteamPreview[]> {
  const results = await Promise.allSettled(STEAM_VARIANTS.map((v) => steamVariant(appId, v)))
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

/**
 * Ярлык игры Steam с рабочего стола (.url): из него берутся AppID и хеш
 * иконки, сама иконка скачивается с CDN Steam (раздел 10.1). Браузер не
 * может прочитать .ico с диска по пути из ярлыка, а CDN отдаёт тот же файл.
 */
async function iconFromShortcut(file: File): Promise<IconFromFile> {
  if (file.size > SHORTCUT_MAX_BYTES) throw new IconImageError('shortcut')
  const shortcut = parseSteamShortcut(await file.text())
  if (!shortcut?.iconHash) throw new IconImageError('shortcut')
  const response = await fetch(steamClientIconUrl(shortcut.appId, shortcut.iconHash), {
    mode: 'cors',
  }).catch(() => null)
  if (!response?.ok) throw new IconImageError('steam')
  return { png: await render(await response.blob(), 'center'), appId: shortcut.appId }
}

export interface IconFromFile {
  png: Blob
  /** AppID из ярлыка Steam */
  appId?: number
}

/** Картинка или ярлык Steam — из перетаскивания, буфера обмена или выбора файла */
export async function iconFromAnyFile(file: File): Promise<IconFromFile> {
  if (isShortcutFile(file.name)) return iconFromShortcut(file)
  return { png: await iconFromFile(file) }
}

/** Первый файл из буфера обмена или перетаскивания */
export function droppedFile(items: DataTransfer | null): File | null {
  return items?.files[0] ?? null
}
