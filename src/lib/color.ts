/** Умножает яркость цвета #rrggbb на k, результат — rgb() */
export function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.min(255, Math.round(((n >> shift) & 255) * k))
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}
