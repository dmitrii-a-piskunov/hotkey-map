import { create } from 'zustand'

/** Открыто ли окно «Настройки»; живёт только в сессии */
export const useSettingsDialog = create<{ open: boolean }>()(() => ({ open: false }))

export function openSettings(): void {
  useSettingsDialog.setState({ open: true })
}
