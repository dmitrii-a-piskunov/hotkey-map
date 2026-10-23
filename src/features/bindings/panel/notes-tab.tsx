import { useEffect, useId, useRef, useState } from 'react'
import { Field } from '@/components/common/field'
import { Textarea } from '@/components/ui/input'
import { LIMITS } from '@/domain/names'
import type { Game, Profile } from '@/domain/types'
import { registerFlushHook } from '@/features/data/flush-hooks'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { setNotesCmd } from '../commands'

/**
 * Заметки профиля (FR-11). Текст сохраняется при уходе из поля, при смене
 * профиля и при закрытии страницы — не на каждый символ, чтобы отмена
 * (FR-24) была одним шагом.
 */
export function NotesTab({ game, profile }: { game: Game; profile: Profile }) {
  const id = useId()
  const [text, setText] = useState(profile.notes)
  // Последний текст и куда его сохранить — для сохранения при уходе
  const latest = useRef({ gameId: game.id, profileId: profile.id, text: profile.notes })
  useEffect(() => {
    latest.current = { gameId: game.id, profileId: profile.id, text }
  })

  useEffect(() => {
    const save = () => {
      const { gameId, profileId, text: notes } = latest.current
      setNotesCmd(gameId, profileId, notes)
    }
    const unregister = registerFlushHook(save)
    return () => {
      unregister()
      save()
    }
  }, [])

  return (
    <Field
      label={ru.profiles.notes}
      htmlFor={`${id}-notes`}
      hint={fill(ru.profiles.notesHint, { max: LIMITS.notes })}
      className="px-1"
    >
      <Textarea
        id={`${id}-notes`}
        rows={12}
        maxLength={LIMITS.notes}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
        }}
        onBlur={() => {
          setNotesCmd(game.id, profile.id, text)
        }}
      />
    </Field>
  )
}
