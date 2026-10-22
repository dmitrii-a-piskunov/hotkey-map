import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import { browserPersistenceEnv } from '@/features/persistence/browser-env'
import { PersistenceSession } from '@/features/persistence/session'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root not found')
}

// Сессия запускается один раз здесь, а не в эффекте: StrictMode вызывает эффекты дважды
const session = new PersistenceSession(browserPersistenceEnv())
void session.start()

createRoot(root).render(
  <StrictMode>
    <App session={session} />
  </StrictMode>,
)
