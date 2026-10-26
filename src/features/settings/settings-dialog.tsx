import { FolderOpen } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ActionButton, ConfirmRow } from '@/components/common/action-buttons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePersistence } from '@/features/persistence/persistence-context'
import { usePersistenceStatus } from '@/features/persistence/status-store'
import { ru } from '@/i18n/ru'
import { fill, formatDateTime } from '@/lib/format'
import type { BackupInfo } from '@/storage/storage-adapter'
import { useSettingsDialog } from './settings-ui'

const t = ru.settings

type Note = { tone: 'info' | 'error'; text: string } | null

function NoteLine({ note }: { note: Note }) {
  if (!note) return null
  return (
    <p
      role={note.tone === 'error' ? 'alert' : 'status'}
      className={
        note.tone === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
      }
    >
      {note.text}
    </p>
  )
}

/** FR-19: папка данных и её смена */
function FolderSection({ readOnly }: { readOnly: boolean }) {
  const session = usePersistence()
  const mode = usePersistenceStatus((s) => s.mode)
  const folderName = usePersistenceStatus((s) => s.folderName)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState<Note>(null)

  if (mode === 'browser') {
    return <p className="text-sm text-muted-foreground">{t.browserMode}</p>
  }

  const currentName = () => usePersistenceStatus.getState().folderName ?? ''

  const change = async () => {
    setNote(null)
    try {
      const result = await session.changeFolder()
      if (result === 'has-data') setAsking(true)
      else if (result === 'same') setNote({ tone: 'info', text: t.sameFolder })
      else if (result === 'moved')
        setNote({ tone: 'info', text: fill(t.moved, { name: currentName() }) })
    } catch (e) {
      console.error('Changing the data folder failed', e)
      setNote({ tone: 'error', text: t.changeFailed })
    }
  }

  const finish = async (choice: 'open' | 'replace' | 'cancel') => {
    try {
      const result = await session.finishFolderChange(choice)
      setAsking(false)
      if (result === 'corrupted') setNote({ tone: 'error', text: t.folderCorrupted })
      else if (result === 'newer') setNote({ tone: 'error', text: t.folderNewer })
      else if (choice === 'open')
        setNote({ tone: 'info', text: fill(t.opened, { name: currentName() }) })
      else if (choice === 'replace')
        setNote({ tone: 'info', text: fill(t.moved, { name: currentName() }) })
    } catch (e) {
      console.error('Changing the data folder failed', e)
      setAsking(false)
      setNote({ tone: 'error', text: t.changeFailed })
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm" data-testid="settings-folder">
          {folderName}
        </span>
        {!asking && (
          <ActionButton variant="outline" onClick={change} disabled={readOnly}>
            {t.changeFolder}
          </ActionButton>
        )}
      </div>
      {asking && (
        <div className="grid gap-2 rounded-md border p-3" role="group" aria-label={t.hasDataTitle}>
          <p className="text-sm">{t.hasData}</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => finish('open')}>{t.openFolderData}</ActionButton>
            <ActionButton variant="outline" onClick={() => finish('replace')}>
              {t.replaceFolderData}
            </ActionButton>
            <ActionButton variant="outline" onClick={() => finish('cancel')}>
              {ru.common.cancel}
            </ActionButton>
          </div>
        </div>
      )}
      <NoteLine note={note} />
    </div>
  )
}

/** FR-20: резервные копии и восстановление */
function BackupsSection({ readOnly }: { readOnly: boolean }) {
  const session = usePersistence()
  const folderName = usePersistenceStatus((s) => s.folderName)
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [note, setNote] = useState<Note>(null)

  // Список перечитывается после восстановления и смены папки
  useEffect(() => {
    let alive = true
    session
      .listBackups()
      .then((list) => {
        if (alive) setBackups(list)
      })
      .catch((e: unknown) => {
        console.error('Listing backups failed', e)
        if (alive) setBackups([])
      })
    return () => {
      alive = false
    }
  }, [session, folderName, note])

  const restore = async (b: BackupInfo, date: string) => {
    try {
      const ok = await session.restoreFromSettings(b.name)
      setNote(
        ok
          ? { tone: 'info', text: fill(t.restored, { date }) }
          : { tone: 'error', text: fill(t.restoreFailed, { date }) },
      )
    } catch (e) {
      console.error('Restoring a backup failed', e)
      setNote({ tone: 'error', text: fill(t.restoreFailed, { date }) })
    }
  }

  if (!backups) return <p className="text-sm text-muted-foreground">{ru.storage.loading}</p>
  return (
    <div className="grid gap-2">
      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noBackups}</p>
      ) : (
        <ul className="grid gap-2" aria-label={t.backups}>
          {backups.map((b) => {
            const date = formatDateTime(b.createdAt)
            return (
              <li key={b.name} className="rounded-md border px-3 py-2">
                <ConfirmRow
                  label={<span className="text-sm tabular-nums">{date}</span>}
                  question={fill(t.restoreConfirm, { date })}
                  action={t.restore}
                  disabled={readOnly}
                  onConfirm={() => restore(b, date)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <NoteLine note={note} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** «Настройки» из меню шапки (раздел 8.2): папка данных, копии, версия */
export function SettingsDialog() {
  const open = useSettingsDialog((s) => s.open)
  const readOnly = usePersistenceStatus((s) => s.readOnly)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        useSettingsDialog.setState({ open: o })
      }}
    >
      <DialogContent closeLabel={ru.common.close} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{readOnly ? t.readOnly : t.description}</DialogDescription>
        </DialogHeader>
        {open && (
          <>
            <Section title={t.folder}>
              <FolderSection readOnly={readOnly} />
            </Section>
            <Section title={t.backups}>
              <p className="text-xs text-muted-foreground">{t.backupsHint}</p>
              <BackupsSection readOnly={readOnly} />
            </Section>
            <Section title={t.version}>
              <p className="text-sm tabular-nums" data-testid="settings-version">
                {__APP_VERSION__}
              </p>
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
