import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/app'
import { ru } from '@/i18n/ru'

describe('App', () => {
  it('renders the title, version and devices', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: ru.app.title })).toBeInTheDocument()
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: ru.devices.keyboard })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: ru.devices.mouse })).toBeInTheDocument()
  })
})
