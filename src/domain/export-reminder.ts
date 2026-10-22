/** Напоминание об экспорте в режиме Firefox (FR-23, раздел 7.4) */

export const EXPORT_REMINDER_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Пора ли напомнить об экспорте. Если экспорта ещё не было, отсчёт идёт от
 * момента, когда данные впервые легли в браузер.
 */
export function needsExportReminder(
  now: Date,
  lastExportAt: string | undefined,
  dataSince: Date | null,
): boolean {
  const from = lastExportAt === undefined ? dataSince : new Date(lastExportAt)
  if (from === null || Number.isNaN(from.getTime())) return false
  return now.getTime() - from.getTime() >= EXPORT_REMINDER_DAYS * DAY_MS
}
