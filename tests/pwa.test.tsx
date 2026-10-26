import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { usePwaUpdate } from '@/features/pwa/pwa-update'
import { UpdateBanner } from '@/features/pwa/update-banner'
import { ru } from '@/i18n/ru'

describe('update banner (FR-28)', () => {
  it('is hidden until a new version is ready; «Обновить» applies it', async () => {
    const update = vi.fn()
    usePwaUpdate.setState({ needRefresh: false, update })
    const { rerender } = render(<UpdateBanner />)
    expect(screen.queryByText(ru.pwa.updateReady)).toBeNull()

    usePwaUpdate.setState({ needRefresh: true })
    rerender(<UpdateBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(ru.pwa.updateReady)
    await userEvent.setup().click(screen.getByRole('button', { name: ru.pwa.update }))
    expect(update).toHaveBeenCalledOnce()
  })
})
