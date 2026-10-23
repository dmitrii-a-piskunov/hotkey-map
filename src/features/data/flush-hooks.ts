/**
 * Несохранённый ввод в полях (заметки профиля) перед закрытием страницы
 * (NFR-04): поле регистрирует функцию, которая переносит текст в данные,
 * а приложение вызывает их до записи на диск.
 */

const hooks = new Set<() => void>()

export function registerFlushHook(hook: () => void): () => void {
  hooks.add(hook)
  return () => {
    hooks.delete(hook)
  }
}

export function runFlushHooks(): void {
  hooks.forEach((hook) => {
    hook()
  })
}
