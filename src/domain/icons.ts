/**
 * Иконки игр (FR-05, раздел 12): только PNG, JPG, WebP, ICO до 1 МБ, SVG
 * запрещён. Картинка перерисовывается в PNG 128×128 и лежит в icons/.
 * Здесь — чистая часть: проверка файла, имена, варианты Steam, геометрия
 * обрезки и уборка файлов, на которые ничто не ссылается.
 */

export const ICON_SIZE = 128
export const ICON_MAX_BYTES = 1024 * 1024

const ICON_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}
const ICON_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'ico'])

export type IconFileError = 'type' | 'size'

/**
 * Проверка картинки до чтения. Тип берётся из MIME, а если браузер его не
 * указал (бывает у ICO при перетаскивании) — из расширения имени.
 */
export function iconFileError(file: {
  type: string
  size: number
  name?: string
}): IconFileError | null {
  const ext = file.name?.split('.').pop()?.toLowerCase() ?? ''
  const typeOk = file.type === '' ? ICON_EXTENSIONS.has(ext) : file.type in ICON_TYPES
  if (!typeOk) return 'type'
  if (file.size > ICON_MAX_BYTES) return 'size'
  return null
}

/** Имя файла иконки: новое при каждой замене, чтобы отмена не ссылалась на перезаписанный файл */
export function iconFileName(gameId: string, uniqueId: string): string {
  return `${gameId}-${uniqueId.slice(0, 8)}.png`
}

/** Варианты иконки из Steam (раздел 10.1): CDN отдаёт их с CORS */
export type SteamVariant = 'header' | 'library' | 'logo'

export const STEAM_VARIANTS: readonly SteamVariant[] = ['header', 'library', 'logo']

const STEAM_FILES: Record<SteamVariant, string> = {
  header: 'header.jpg',
  library: 'library_600x900.jpg',
  logo: 'logo.png',
}

export function steamImageUrl(appId: number, variant: SteamVariant): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${STEAM_FILES[variant]}`
}

export interface DrawPlan {
  /** Область исходной картинки */
  sx: number
  sy: number
  sw: number
  sh: number
  /** Куда она ложится в квадрате size×size */
  dx: number
  dy: number
  dw: number
  dh: number
}

/**
 * Как уложить картинку w×h в квадрат:
 * center — квадрат из центра (картинки вручную и header.jpg Steam);
 * top — квадрат от верхнего края (вертикальная обложка library);
 * contain — целиком, с полями (logo.png на тёмном фоне).
 */
export function drawPlan(
  w: number,
  h: number,
  fit: 'center' | 'top' | 'contain',
  size = ICON_SIZE,
  padding = 0,
): DrawPlan {
  if (fit === 'contain') {
    const inner = size - padding * 2
    const scale = Math.min(inner / w, inner / h)
    const dw = w * scale
    const dh = h * scale
    return { sx: 0, sy: 0, sw: w, sh: h, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh }
  }
  const side = Math.min(w, h)
  const sx = (w - side) / 2
  const sy = fit === 'top' ? 0 : (h - side) / 2
  return { sx, sy, sw: side, sh: side, dx: 0, dy: 0, dw: size, dh: size }
}

/** Иконки, на которые ссылается текст data.json; null — текст не читается */
export function referencedIcons(text: string): Set<string> | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || !('games' in raw) || !Array.isArray(raw.games)) {
    return null
  }
  const names = new Set<string>()
  for (const game of raw.games as unknown[]) {
    if (
      typeof game === 'object' &&
      game !== null &&
      'icon' in game &&
      typeof game.icon === 'string'
    ) {
      names.add(game.icon)
    }
  }
  return names
}

/**
 * Файлы иконок, которые можно удалить: на них не ссылаются ни data.json, ни
 * одна резервная копия. Если какой-то текст не читается — не удаляем ничего.
 */
export function unusedIcons(files: readonly string[], texts: readonly string[]): string[] {
  const used = new Set<string>()
  for (const text of texts) {
    const refs = referencedIcons(text)
    if (refs === null) return []
    refs.forEach((n) => used.add(n))
  }
  return files.filter((f) => !used.has(f))
}
