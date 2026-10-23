import { Group } from 'lucide-react'
import { useId, useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
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
import { PALETTE } from '@/domain/categories'
import {
  groupableInputs,
  inputsInOtherGroups,
  keyGroupNameError,
  type KeyGroupDraft,
} from '@/domain/key-groups'
import { LIMITS } from '@/domain/names'
import type { KeyGroup, Profile } from '@/domain/types'
import { ColorField } from '@/features/games/editor/color-field'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { createKeyGroupCmd, updateKeyGroupCmd } from '../commands'
import { movedList } from '../format'

const t = ru.keyGroups

/** Цвет новой группы — первый из палитры, которого нет у групп профиля */
function nextGroupColor(profile: Profile): string {
  const used = new Set(profile.keyGroups.map((g) => g.color.toUpperCase()))
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[0]
}

/** Название и цвет группы (FR-29) */
export function KeyGroupDialog({
  group,
  defaultColor,
  onSubmit,
  onClose,
}: {
  group: KeyGroup | null
  defaultColor?: string
  onSubmit: (draft: KeyGroupDraft) => void
  onClose: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<KeyGroupDraft>({
    name: group?.name ?? '',
    color: group?.color ?? defaultColor ?? PALETTE[0],
  })
  const [touched, setTouched] = useState(false)
  const error = touched ? nameErrorText(keyGroupNameError(draft.name), LIMITS.keyGroup) : null

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{group ? t.editTitle : t.createTitle}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (keyGroupNameError(draft.name)) return
            onSubmit(draft)
          }}
        >
          <Field label={t.name} htmlFor={`${id}-name`} error={error}>
            <Input
              id={`${id}-name`}
              autoFocus
              value={draft.name}
              {...invalidProps(`${id}-name`, error)}
              onChange={(e) => {
                setDraft((d) => ({ ...d, name: e.target.value }))
                setTouched(true)
              }}
            />
          </Field>
          <Field label={t.color} htmlFor={`${id}-color`}>
            <ColorField
              id={`${id}-color`}
              value={draft.color}
              onChange={(color) => {
                setDraft((d) => ({ ...d, color }))
              }}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {ru.common.cancel}
            </Button>
            <Button type="submit">{group ? ru.common.save : ru.common.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Изменить название и цвет группы */
export function EditKeyGroupDialog({ group, onClose }: { group: KeyGroup; onClose: () => void }) {
  return (
    <KeyGroupDialog
      group={group}
      onClose={onClose}
      onSubmit={(draft) => {
        updateKeyGroupCmd(group.id, draft)
        onClose()
      }}
    />
  )
}

/**
 * «Создать группу» из выделенных клавиш (FR-29). Клавиши из других групп
 * переносятся после вопроса: клавиша бывает только в одной группе.
 */
export function CreateGroupButton({
  profile,
  codes,
}: {
  profile: Profile
  codes: readonly string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<KeyGroupDraft | null>(null)
  const inputs = groupableInputs(codes)
  const taken = inputsInOtherGroups(profile, inputs)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={inputs.length === 0}
        onClick={() => {
          setOpen(true)
        }}
      >
        <Group />
        {ru.panel.createGroup}
      </Button>
      {open && (
        <KeyGroupDialog
          group={null}
          defaultColor={nextGroupColor(profile)}
          onClose={() => {
            setOpen(false)
          }}
          onSubmit={(draft) => {
            setOpen(false)
            if (taken.length > 0) setPending(draft)
            else createKeyGroupCmd(draft, inputs)
          }}
        />
      )}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setPending(null)
          }}
          title={t.moveTitle}
          description={fill(t.moveText, { list: movedList(taken) })}
          confirmLabel={t.move}
          destructive={false}
          onConfirm={() => {
            createKeyGroupCmd(pending, inputs)
            setPending(null)
          }}
        />
      )}
    </>
  )
}
