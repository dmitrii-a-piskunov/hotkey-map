import { Keyboard } from 'lucide-react'
import { ru } from '@/i18n/ru'

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
      <Keyboard className="size-16 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-4xl font-semibold tracking-tight">{ru.app.title}</h1>
      <p className="text-lg text-muted-foreground">{ru.app.tagline}</p>
      <p className="text-sm text-muted-foreground">{ru.app.placeholder}</p>
      <p className="text-xs text-muted-foreground">
        {ru.app.version} {__APP_VERSION__}
      </p>
    </main>
  )
}
