import { useEffect } from 'react'
import { isImportFileName, openImportFile } from './import'

/**
 * Перетаскивание файла в любое место окна. Зона иконки в редакторе игры
 * обрабатывает своё перетаскивание сама и отменяет действие по умолчанию —
 * такой drop сюда не попадает. Чужой файл, брошенный в окно, браузер не
 * откроет вместо приложения.
 */
export function useImportDrop(): void {
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const onOver = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      if (e.defaultPrevented || !hasFiles(e)) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      const file = files.find((f) => isImportFileName(f.name)) ?? files[0]
      if (file) void openImportFile(file)
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])
}
