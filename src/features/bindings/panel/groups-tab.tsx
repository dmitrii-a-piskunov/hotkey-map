import { Ellipsis, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { copyConflicts, groupableInputs, inputsInOtherGroups } from '@/domain/key-groups'
import type { Game, KeyGroup, Profile } from '@/domain/types'
import { useDevicesStore } from '@/features/devices/store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import {
  addToKeyGroupCmd,
  copyKeyGroupCmd,
  removeFromKeyGroupCmd,
  removeKeyGroupCmd,
} from '../commands'
import { inputName, movedList } from '../format'
import { CreateGroupButton, EditKeyGroupDialog } from './key-group-dialog'

const t = ru.keyGroups

/** Вопрос перед действием с группой: перенос клавиш или удаление */
type Pending =
  | { kind: 'add'; group: KeyGroup; codes: string[]; text: string }
  | { kind: 'copy'; group: KeyGroup; profile: Profile; text: string }
  | { kind: 'delete'; group: KeyGroup }

function GroupItem({
  game,
  profile,
  group,
  selected,
  onAsk,
  onEdit,
  onCopied,
}: {
  game: Game
  profile: Profile
  group: KeyGroup
  selected: readonly string[]
  onAsk: (p: Pending) => void
  onEdit: () => void
  onCopied: (profile: Profile) => void
}) {
  const toAdd = groupableInputs(selected).filter((c) => !group.inputs.includes(c))
  const toRemove = selected.filter((c) => group.inputs.includes(c))
  const others = game.profiles.filter((p) => p.id !== profile.id)

  return (
    <li
      aria-label={group.name}
      className="grid gap-1.5 rounded-md border px-2 py-2"
      data-testid="key-group"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-3.5 shrink-0 rounded"
          style={{ background: group.color }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={group.name}>
          {group.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {fill(t.keys, { count: group.inputs.length })}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${t.menu}: ${group.name}`}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>{ru.common.edit}</DropdownMenuItem>
            {others.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t.copyTo}</DropdownMenuLabel>
                {others.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => {
                      const taken = copyConflicts(game, profile.id, group.id, p.id)
                      if (taken.length === 0) {
                        copyKeyGroupCmd(group.id, p.id)
                        onCopied(p)
                        return
                      }
                      onAsk({
                        kind: 'copy',
                        group,
                        profile: p,
                        text: fill(t.copyMoveText, { profile: p.name, list: movedList(taken) }),
                      })
                    }}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                onAsk({ kind: 'delete', group })
              }}
            >
              {t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {group.inputs.length > 0 && (
        <p className="text-xs text-muted-foreground">{group.inputs.map(inputName).join(' ')}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={toAdd.length === 0}
          title={selected.length === 0 ? t.selectFirst : undefined}
          onClick={() => {
            const taken = inputsInOtherGroups(profile, toAdd, group.id)
            if (taken.length === 0) addToKeyGroupCmd(group.id, toAdd)
            else
              onAsk({
                kind: 'add',
                group,
                codes: toAdd,
                text: fill(t.moveText, { list: movedList(taken) }),
              })
          }}
        >
          <Plus />
          {t.addSelected}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={toRemove.length === 0}
          onClick={() => {
            removeFromKeyGroupCmd(group.id, toRemove)
          }}
        >
          <Minus />
          {t.removeSelected}
        </Button>
      </div>
    </li>
  )
}

/** Вкладка «Группы» (FR-29): список групп профиля и действия с ними */
export function GroupsTab({ game, profile }: { game: Game; profile: Profile }) {
  const selected = useDevicesStore((s) => s.selection.selected)
  const [pending, setPending] = useState<Pending | null>(null)
  const [editing, setEditing] = useState<KeyGroup | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 px-1">
        <CreateGroupButton profile={profile} codes={selected} />
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">{t.selectFirst}</span>
        )}
      </div>
      {status && (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          {status}
        </p>
      )}
      {profile.keyGroups.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="grid gap-2">
          {profile.keyGroups.map((g) => (
            <GroupItem
              key={g.id}
              game={game}
              profile={profile}
              group={g}
              selected={selected}
              onAsk={setPending}
              onEdit={() => {
                setEditing(g)
              }}
              onCopied={(p) => {
                setStatus(fill(t.copied, { name: p.name }))
              }}
            />
          ))}
        </ul>
      )}
      {editing && (
        <EditKeyGroupDialog
          group={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setPending(null)
          }}
          title={
            pending.kind === 'delete'
              ? fill(t.deleteTitle, { name: pending.group.name })
              : t.moveTitle
          }
          description={pending.kind === 'delete' ? t.deleteText : pending.text}
          confirmLabel={pending.kind === 'delete' ? ru.common.delete : t.move}
          destructive={pending.kind === 'delete'}
          onConfirm={() => {
            if (pending.kind === 'delete') removeKeyGroupCmd(pending.group.id)
            if (pending.kind === 'add') addToKeyGroupCmd(pending.group.id, pending.codes)
            if (pending.kind === 'copy') {
              copyKeyGroupCmd(pending.group.id, pending.profile.id)
              setStatus(fill(t.copied, { name: pending.profile.name }))
            }
            setPending(null)
          }}
        />
      )}
    </div>
  )
}
