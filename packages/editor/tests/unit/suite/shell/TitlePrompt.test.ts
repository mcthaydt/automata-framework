// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TitlePrompt from '#src/features/suite/shell/TitlePrompt.svelte'

// The first write's title (editor suite spec §5 flow 3): a change set needs one before anything is written.
describe('TitlePrompt', () => {
  it('starts the change set with the title typed', async () => {
    const onsubmit = vi.fn()
    render(TitlePrompt, { open: true, onsubmit, oncancel: () => {} })
    const start = screen.getByRole('button', { name: 'Start' })
    expect(start).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Faster player')
    await userEvent.click(start)
    expect(onsubmit).toHaveBeenCalledWith('Faster player')
  })

  it('a title with no letter or digit cannot start one; Cancel writes nothing', async () => {
    const oncancel = vi.fn()
    const onsubmit = vi.fn()
    render(TitlePrompt, { open: true, onsubmit, oncancel })
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), '---')
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(oncancel).toHaveBeenCalled()
    expect(onsubmit).not.toHaveBeenCalled()
  })
})
