import { ChevronDown, Copy, NotebookPen, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { canRemoveProfile } from '@/domain/profiles'
import { duplicateProfileCmd, removeProfileCmd, selectProfileCmd } from '@/features/games/commands'
import { useGamesUi } from '@/features/games/ui-store'
import { useCurrentGame, useCurrentProfile } from '@/features/games/use-current'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'

/** Выбор профиля и действия с ним в шапке (FR-11) */
export function ProfilePicker() {
  const game = useCurrentGame()
  const profile = useCurrentProfile()
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!game || !profile) return null
  const removable = canRemoveProfile(game)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={ru.profiles.chooseProfile}
            className="max-w-48"
          >
            <UserRound className="text-muted-foreground" />
            <span className="truncate" data-testid="current-profile">
              {profile.name}
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuRadioGroup
            value={profile.id}
            onValueChange={(id) => {
              selectProfileCmd(game.id, id)
            }}
          >
            {game.profiles.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id} title={p.name}>
                <span className="truncate">{p.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              useGamesUi.setState({ profile: { mode: 'create' } })
            }}
          >
            <Plus />
            {ru.profiles.newProfile}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useGamesUi.setState({ profile: { mode: 'edit', profileId: profile.id } })
            }}
          >
            <NotebookPen />
            {ru.profiles.renameProfile}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              duplicateProfileCmd(game.id, profile.id)
            }}
          >
            <Copy />
            {ru.profiles.duplicate}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!removable}
            title={removable ? undefined : ru.profiles.lastProfile}
            onSelect={() => {
              setConfirmDelete(true)
            }}
          >
            <Trash2 />
            {ru.profiles.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={fill(ru.profiles.deleteTitle, { name: profile.name })}
        description={fill(ru.profiles.deleteText, { bindings: profile.bindings.length })}
        onConfirm={() => {
          removeProfileCmd(game.id, profile.id)
        }}
      />
    </>
  )
}
