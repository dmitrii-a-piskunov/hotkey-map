/** Скачивание файла обычной загрузкой: одинаково в Chrome и Firefox (FR-21) */
export function downloadFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Firefox начинает загрузку не сразу: ссылку освобождаем позже
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}
