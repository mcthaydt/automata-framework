// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EmptyState from '#src/shared/kit/states/EmptyState.svelte'

// An empty list says what is missing, why, and gives one way forward: one heading, one line and one button.
describe('EmptyState', () => {
  it('has one heading, one line on why it is empty, and one button that answers', async () => {
    const onclick = vi.fn()
    render(EmptyState, {
      icon: 'person',
      title: 'No characters yet',
      why: 'Add one to place it in your levels.',
      action: { label: 'Add a character', onclick },
    })
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'No characters yet' })).toBeInTheDocument()
    expect(screen.getByText('Add one to place it in your levels.')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Add a character' }))
    expect(onclick).toHaveBeenCalledOnce()
  })

  it('hides its icon from a screen reader, which hears the words', () => {
    const { container } = render(EmptyState, {
      icon: 'person',
      title: 'No characters yet',
      why: 'Add one to place it in your levels.',
      action: { label: 'Add a character', onclick: () => {} },
    })
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
