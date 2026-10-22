import { describe, expect, it } from 'vitest'
import { needsExportReminder } from '@/domain/export-reminder'

const day = 24 * 60 * 60 * 1000
const now = new Date(2026, 9, 22, 12, 0, 0)
const ago = (days: number) => new Date(now.getTime() - days * day)

describe('needsExportReminder (FR-23)', () => {
  it('counts from the last export', () => {
    expect(needsExportReminder(now, ago(6).toISOString(), ago(30))).toBe(false)
    expect(needsExportReminder(now, ago(7).toISOString(), ago(30))).toBe(true)
  })

  it('counts from the first data in the browser when there was no export', () => {
    expect(needsExportReminder(now, undefined, ago(3))).toBe(false)
    expect(needsExportReminder(now, undefined, ago(8))).toBe(true)
  })

  it('does not remind without any reference date', () => {
    expect(needsExportReminder(now, undefined, null)).toBe(false)
    expect(needsExportReminder(now, 'not a date', null)).toBe(false)
  })
})
