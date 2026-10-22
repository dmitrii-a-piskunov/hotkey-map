/** Какие диалоги игр и профилей открыты. Живёт только в сессии */

import { create } from 'zustand'

export type EditorTab = 'general' | 'contexts' | 'categories' | 'actions' | 'bindParam' | 'settings'

export type ProfileDialog = { mode: 'create' } | { mode: 'edit'; profileId: string }

interface GamesUi {
  editor: { gameId: string; tab: EditorTab } | null
  createGame: boolean
  presets: boolean
  profile: ProfileDialog | null
}

export const useGamesUi = create<GamesUi>()(() => ({
  editor: null,
  createGame: false,
  presets: false,
  profile: null,
}))

export function openEditor(gameId: string, tab: EditorTab = 'general'): void {
  useGamesUi.setState({ editor: { gameId, tab } })
}

export function closeEditor(): void {
  useGamesUi.setState({ editor: null })
}

export function setEditorTab(tab: EditorTab): void {
  useGamesUi.setState((s) => (s.editor ? { editor: { ...s.editor, tab } } : s))
}
