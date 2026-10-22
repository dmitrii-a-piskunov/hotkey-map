import { ProfileDialog } from '@/features/profiles/profile-dialog'
import { CreateGameDialog } from './create-game-dialog'
import { GameEditor } from './editor/game-editor'
import { PresetsDialog } from './presets-dialog'

/** Диалоги игр и профилей, открываются из шапки и пустого состояния */
export function GamesDialogs() {
  return (
    <>
      <CreateGameDialog />
      <PresetsDialog />
      <GameEditor />
      <ProfileDialog />
    </>
  )
}
