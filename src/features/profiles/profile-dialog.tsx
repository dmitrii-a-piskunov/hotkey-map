import { useState } from 'react'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/domain/names'
import { profileNameError } from '@/domain/profiles'
import type { Game, Profile } from '@/domain/types'
import { createProfileCmd, renameProfileCmd } from '@/features/games/commands'
import { useGamesUi } from '@/features/games/ui-store'
import { useCurrentGame } from '@/features/games/use-current'
import { ru } from '@/i18n/ru'

function close() {
  useGamesUi.setState({ profile: null })
}

function ProfileForm({ game, profile }: { game: Game; profile: Profile | undefined }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [touched, setTouched] = useState(false)
  const nameError = touched
    ? nameErrorText(profileNameError(game, name, profile?.id), LIMITS.profile)
    : null
  const invalid = profileNameError(game, name, profile?.id) !== null

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (invalid) return
        if (profile) renameProfileCmd(game.id, profile.id, name)
        else createProfileCmd(game.id, name)
        close()
      }}
    >
      <Field label={ru.profiles.name} htmlFor="profile-name" error={nameError}>
        <Input
          id="profile-name"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
          {...invalidProps('profile-name', nameError)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close}>
          {ru.common.cancel}
        </Button>
        <Button type="submit" disabled={touched && invalid}>
          {profile ? ru.common.save : ru.common.create}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Новый профиль или переименование; заметки — во вкладке «Заметки» панели (FR-11) */
export function ProfileDialog() {
  const dialog = useGamesUi((s) => s.profile)
  const game = useCurrentGame()
  const profile =
    dialog?.mode === 'edit' ? game?.profiles.find((p) => p.id === dialog.profileId) : undefined
  const open = dialog !== null && game !== undefined && (dialog.mode === 'create' || !!profile)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{profile ? ru.profiles.renameProfile : ru.profiles.newProfile}</DialogTitle>
        </DialogHeader>
        {open && <ProfileForm key={profile?.id ?? 'new'} game={game} profile={profile} />}
      </DialogContent>
    </Dialog>
  )
}
