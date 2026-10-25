import { describe, expect, it } from 'vitest'
import { parseAppData, serializeAppData } from '@/domain/app-data'
import { appSettingsSchema, CURRENT_SCHEMA_VERSION } from '@/domain/schema'
import { sampleData } from '../fixtures'

describe('schema v3', () => {
  it('migrates v2 data: games unchanged, keyboard color defaults to standard', () => {
    const data = sampleData()
    const settingsV2: Record<string, unknown> = { ...data.appSettings }
    delete settingsV2.keyboardColor
    const v2 = { ...data, schemaVersion: 2, appSettings: settingsV2 }
    const result = parseAppData(JSON.stringify(v2))
    expect(CURRENT_SCHEMA_VERSION).toBe(3)
    expect(result).toMatchObject({ kind: 'ok', migratedFrom: 2 })
    if (result.kind === 'ok') {
      expect(result.data.schemaVersion).toBe(3)
      expect(result.data.games).toEqual(data.games)
      expect(result.data.appSettings.keyboardColor).toBe('standard')
    }
  })

  it('keeps the black keyboard color through save and load', () => {
    const data = sampleData()
    const black = { ...data, appSettings: { ...data.appSettings, keyboardColor: 'black' as const } }
    const result = parseAppData(serializeAppData(black))
    expect(result).toMatchObject({ kind: 'ok', migratedFrom: null })
    if (result.kind === 'ok') expect(result.data.appSettings.keyboardColor).toBe('black')
  })

  it('rejects unknown keyboard colors', () => {
    expect(appSettingsSchema.safeParse({ keyboardColor: 'white' }).success).toBe(false)
  })
})
