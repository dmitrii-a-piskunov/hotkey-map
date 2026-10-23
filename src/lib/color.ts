/** Умножает яркость цвета #rrggbb на k, результат — rgb() */
export function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.min(255, Math.round(((n >> shift) & 255) * k))
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}

/** Относительная яркость #rrggbb по WCAG: 0 — чёрный, 1 — белый */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const lin = (shift: number) => {
    const c = ((n >> shift) & 255) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(16) + 0.7152 * lin(8) + 0.0722 * lin(0)
}

/** Светлый фон — тёмный текст, тёмный фон — светлый (контраст для подписей) */
export function isLight(hex: string): boolean {
  // Порог, при котором контраст с белым и с чёрным одинаковый
  return luminance(hex) > 0.179
}
