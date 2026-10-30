import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import UnavailableNotice from './UnavailableNotice.svelte'

describe('UnavailableNotice', () => {
  it('is an alert that says the projects cannot be listed, with the storage reason', () => {
    render(UnavailableNotice, { message: 'Storage is full.', onretry: vi.fn() })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Your projects can’t be listed')
    expect(alert).toHaveTextContent('Storage is full.')
  })

  it('offers Retry, which asks the owner to read the workspace again', async () => {
    const onretry = vi.fn()
    render(UnavailableNotice, { message: 'Storage is full.', onretry })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onretry).toHaveBeenCalledOnce()
  })
})
