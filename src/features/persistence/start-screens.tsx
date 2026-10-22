/**
 * Экраны до главного: первый запуск, разрешение на папку, папка не найдена,
 * повреждённый data.json, данные новее приложения (сценарий 1, раздел 13.1).
 */

import { Check, FolderOpen, Keyboard, Loader2, ShieldAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ru } from '@/i18n/ru'
import { fill, formatDateTime } from '@/lib/format'
import type { BackupInfo } from '@/storage/storage-adapter'
import { usePersistence } from './persistence-context'
import type { Phase } from './status-store'

const t = ru.storage

function Screen({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section
        aria-labelledby="start-screen-title"
        className="flex w-full max-w-lg flex-col gap-4 rounded-xl border bg-card p-8 text-card-foreground shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          <h1 id="start-screen-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        {children}
      </section>
    </main>
  )
}

function Text({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** Кнопка, которая блокируется, пока идёт действие (двойной клик — одно действие) */
function ActionButton({
  onClick,
  children,
  variant,
}: {
  onClick: () => Promise<void>
  children: ReactNode
  variant?: 'default' | 'outline'
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void onClick().finally(() => {
          setBusy(false)
        })
      }}
    >
      {children}
    </Button>
  )
}

function FirstRun() {
  const session = usePersistence()
  return (
    <Screen title={t.welcomeTitle} icon={<Keyboard className="size-6" />}>
      <Text>{ru.app.tagline}.</Text>
      <Text>{t.welcomeText}</Text>
      <p className="flex items-center gap-2 text-sm">
        <Check className="size-4 text-emerald-600" aria-hidden="true" />
        {t.browserSupported}
      </p>
      <div>
        <ActionButton onClick={() => session.chooseFolder()}>
          <FolderOpen />
          {t.chooseFolder}
        </ActionButton>
      </div>
    </Screen>
  )
}

function NeedPermission() {
  const session = usePersistence()
  return (
    <Screen title={t.permissionTitle} icon={<ShieldAlert className="size-6" />}>
      <Text>{t.permissionText}</Text>
      <Text>{t.permissionTip}</Text>
      <div>
        <ActionButton onClick={() => session.grantPermission()}>{t.allowAccess}</ActionButton>
      </div>
    </Screen>
  )
}

function FolderMissing() {
  const session = usePersistence()
  return (
    <Screen title={t.folderMissingTitle} icon={<FolderOpen className="size-6" />}>
      <Text>{t.folderMissingText}</Text>
      <div className="flex gap-2">
        <ActionButton onClick={() => session.chooseFolder()}>{t.chooseOtherFolder}</ActionButton>
        {/* В окне выбора папки есть кнопка создания новой папки */}
        <ActionButton variant="outline" onClick={() => session.chooseFolder()}>
          {t.createFolder}
        </ActionButton>
      </div>
    </Screen>
  )
}

/** Строка с действием и подтверждением на месте: «Восстановить» → «Да / Отмена» */
function ConfirmRow({
  label,
  question,
  action,
  onConfirm,
}: {
  label: ReactNode
  question: string
  action: string
  onConfirm: () => Promise<void>
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <div className="flex items-center justify-between gap-3">
        {label}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAsking(true)
          }}
        >
          {action}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{question}</span>
      <div className="flex gap-2">
        <ActionButton onClick={onConfirm}>{t.confirm}</ActionButton>
        <Button
          variant="outline"
          onClick={() => {
            setAsking(false)
          }}
        >
          {t.cancel}
        </Button>
      </div>
    </div>
  )
}

function Corrupted({
  backups,
  restoreFailed,
}: {
  backups: BackupInfo[]
  restoreFailed: string | null
}) {
  const session = usePersistence()
  const failed = backups.find((b) => b.name === restoreFailed)
  return (
    <Screen title={t.corruptedTitle} icon={<ShieldAlert className="size-6 text-destructive" />}>
      <Text>{t.corruptedText}</Text>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {fill(t.restoreFailed, { date: formatDateTime(failed.createdAt) })}
        </p>
      )}
      <h2 className="text-sm font-medium">{t.backupsTitle}</h2>
      {backups.length === 0 ? (
        <Text>{t.noBackups}</Text>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t.backupsTitle}>
          {backups.map((b) => {
            const date = formatDateTime(b.createdAt)
            return (
              <li key={b.name} className="rounded-md border px-3 py-2">
                <ConfirmRow
                  label={<span className="text-sm tabular-nums">{date}</span>}
                  question={fill(t.restoreConfirm, { date })}
                  action={t.restore}
                  onConfirm={() => session.restoreBackup(b.name)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <div className="border-t pt-4">
        <ConfirmRow
          label={<span />}
          question={t.startEmptyConfirm}
          action={t.startEmpty}
          onConfirm={() => session.startEmpty()}
        />
      </div>
    </Screen>
  )
}

function Reload({ title, text }: { title: string; text: string }) {
  return (
    <Screen title={title} icon={<ShieldAlert className="size-6" />}>
      <Text>{text}</Text>
      <div>
        <Button
          onClick={() => {
            window.location.reload()
          }}
        >
          {t.reloadPage}
        </Button>
      </div>
    </Screen>
  )
}

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {t.loading}
    </main>
  )
}

/** Экран для фазы запуска; для 'ready' — null, показывается главный экран */
export function StartScreen({ phase }: { phase: Phase }) {
  switch (phase.name) {
    case 'loading':
      return <Loading />
    case 'first-run':
      return <FirstRun />
    case 'need-permission':
      return <NeedPermission />
    case 'folder-missing':
      return <FolderMissing />
    case 'corrupted':
      return <Corrupted backups={phase.backups} restoreFailed={phase.restoreFailed} />
    case 'newer':
      return <Reload title={t.newerTitle} text={t.newerText} />
    case 'failed':
      return <Reload title={t.failedTitle} text={t.failedText} />
    case 'ready':
      return null
  }
}
