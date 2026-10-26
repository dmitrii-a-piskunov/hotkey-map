/** Заглушка virtual:pwa-register/react для Vitest: service worker в jsdom нет */
import { useState } from 'react'

export function useRegisterSW() {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: () => Promise.resolve(),
  }
}
