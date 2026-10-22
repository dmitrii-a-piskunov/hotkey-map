import { createContext, useContext } from 'react'
import type { PersistenceSession } from './session'

export const PersistenceContext = createContext<PersistenceSession | null>(null)

/** Сессия хранения: кнопки экранов и плашек вызывают её методы */
export function usePersistence(): PersistenceSession {
  const session = useContext(PersistenceContext)
  if (!session) throw new Error('usePersistence outside PersistenceContext')
  return session
}
