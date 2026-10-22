/**
 * Имена резервных копий: data-ГГГГ-ММ-ДД_ЧЧ-ММ-СС.json по местному времени
 * (FR-20). Если в ту же секунду копия уже есть, добавляется номер: -2, -3…
 */

import type { BackupInfo } from './storage-adapter'

const pad = (n: number) => String(n).padStart(2, '0')

export function timestamp(d: Date): string {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  return `${date}_${time}`
}

const BACKUP_RE = /^data-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-(\d+))?\.json$/

interface ParsedName {
  createdAt: Date
  seq: number
}

function parse(name: string): ParsedName | null {
  const m = BACKUP_RE.exec(name)
  if (!m) return null
  const [y, mo, d, h, mi, s, seq] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  return { createdAt: new Date(y, mo - 1, d, h, mi, s), seq: Number.isNaN(seq) ? 1 : seq }
}

export function isBackupName(name: string): boolean {
  return BACKUP_RE.test(name)
}

export function backupFileName(at: Date, existing: Iterable<string>): string {
  const taken = new Set(existing)
  const base = `data-${timestamp(at)}`
  let name = `${base}.json`
  for (let seq = 2; taken.has(name); seq++) name = `${base}-${seq}.json`
  return name
}

export function damagedFileName(at: Date, existing: Iterable<string>): string {
  const taken = new Set(existing)
  const base = `damaged-${timestamp(at)}`
  let name = `${base}.json`
  for (let seq = 2; taken.has(name); seq++) name = `${base}-${seq}.json`
  return name
}

/** Копии из списка имён, новые первыми; посторонние файлы пропускаются */
export function sortBackups(names: Iterable<string>): BackupInfo[] {
  const parsed: (ParsedName & { name: string })[] = []
  for (const name of names) {
    const p = parse(name)
    if (p) parsed.push({ ...p, name })
  }
  parsed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.seq - a.seq)
  return parsed.map(({ name, createdAt }) => ({ name, createdAt }))
}
