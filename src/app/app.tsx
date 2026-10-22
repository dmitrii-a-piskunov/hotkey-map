import { useEffect } from 'react'
import { PersistenceContext } from '@/features/persistence/persistence-context'
import type { PersistenceSession } from '@/features/persistence/session'
import { StartScreen } from '@/features/persistence/start-screens'
import { usePersistenceStatus } from '@/features/persistence/status-store'
import { StorageBanners } from '@/features/persistence/storage-banners'
import { Workspace } from './workspace'

/**
 * NFR-04: при несохранённых изменениях браузер предупреждает о закрытии,
 * а запись запускается сразу, не дожидаясь задержки автосохранения.
 */
function useUnsavedChangesGuard(session: PersistenceSession): void {
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!usePersistenceStatus.getState().dirty) return
      void session.flush()
      e.preventDefault()
    }
    function onPageHide() {
      void session.flush()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [session])
}

/** Корень: экран запуска, пока данные не открыты, затем главный экран */
export function App({ session }: { session: PersistenceSession }) {
  const phase = usePersistenceStatus((s) => s.phase)
  useUnsavedChangesGuard(session)

  return (
    <PersistenceContext value={session}>
      {phase.name === 'ready' ? (
        <Workspace banners={<StorageBanners />} />
      ) : (
        <StartScreen phase={phase} />
      )}
    </PersistenceContext>
  )
}
