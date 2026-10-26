import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { create } from 'zustand'

interface PwaUpdate {
  /** Новая версия скачана и ждёт кнопки «Обновить» */
  needRefresh: boolean
  update: () => void
}

export const usePwaUpdate = create<PwaUpdate>()(() => ({
  needRefresh: false,
  update: () => undefined,
}))

/**
 * Регистрация service worker (NFR-06) — в корне приложения, на любом
 * экране: офлайн должен работать и до выбора папки.
 */
export function useServiceWorker(): void {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(e: unknown) {
      console.error('Service worker registration failed', e)
    },
  })

  useEffect(() => {
    usePwaUpdate.setState({
      needRefresh,
      update: () => void updateServiceWorker(true),
    })
  }, [needRefresh, updateServiceWorker])
}
