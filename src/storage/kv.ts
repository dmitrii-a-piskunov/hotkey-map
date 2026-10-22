/**
 * Общая база IndexedDB приложения: ссылка на папку данных и, в режиме
 * Firefox, сами данные (FR-19, FR-23). Ключи с префиксами разделяют записи.
 */

import { createStore, type UseStore } from 'idb-keyval'

export const KV_DB = 'hotkey-map'
export const KV_STORE = 'kv'

let store: UseStore | null = null

export function appStore(): UseStore {
  store ??= createStore(KV_DB, KV_STORE)
  return store
}
