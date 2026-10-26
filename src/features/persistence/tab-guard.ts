/**
 * Защита от двух вкладок (FR-27): новая вкладка спрашивает по
 * BroadcastChannel, открыто ли приложение, а вкладка с правом записи
 * отвечает. Вкладка для просмотра не отвечает: когда закроется первая,
 * следующая новая вкладка снова получит право записи.
 */

export interface TabGuard {
  /** true — приложение уже открыто в другой вкладке; эта — только для просмотра */
  otherTabOpen(): Promise<boolean>
}

const CHANNEL = 'hotkey-map:tabs'
/** Сколько ждать ответа другой вкладки при запуске */
export const TAB_REPLY_MS = 300

type Message = 'hello' | 'here'

export function broadcastTabGuard(waitMs = TAB_REPLY_MS): TabGuard {
  return {
    otherTabOpen: () =>
      new Promise((resolve) => {
        if (typeof BroadcastChannel === 'undefined') {
          resolve(false)
          return
        }
        const channel = new BroadcastChannel(CHANNEL)
        let found = false
        let decided = false
        channel.onmessage = (e: MessageEvent<Message>) => {
          if (e.data === 'here') found = true
          // Отвечаем новым вкладкам, только если у нас право записи
          else if (decided && !found) channel.postMessage('here' satisfies Message)
        }
        channel.postMessage('hello' satisfies Message)
        setTimeout(() => {
          decided = true
          // Вкладке для просмотра канал больше не нужен
          if (found) channel.close()
          resolve(found)
        }, waitMs)
      }),
  }
}

/** Одна вкладка: для тестов и окружений без BroadcastChannel */
export const singleTab: TabGuard = { otherTabOpen: () => Promise.resolve(false) }
