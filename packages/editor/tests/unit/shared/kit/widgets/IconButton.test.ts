// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import IconButton from '#src/shared/kit/widgets/IconButton.svelte'

describe('IconButton', () => {
  it('is a plain button named by its label, with the label as its tooltip', () => {
    render(IconButton, { icon: 'undo', label: 'Undo' })
    const button = screen.getByRole('button', { name: 'Undo' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('title', 'Undo')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the label beside the icon when asked, and is still named once', () => {
    render(IconButton, { icon: 'layers', label: 'Layers', showLabel: true })
    const button = screen.getByRole('button', { name: 'Layers' })
    expect(button).toHaveTextContent('Layers')
    expect(button).not.toHaveAttribute('aria-label')
  })

  it('calls onclick, and not when disabled', async () => {
    const onclick = vi.fn()
    const { rerender } = render(IconButton, { icon: 'plus', label: 'Add', onclick })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onclick).toHaveBeenCalledOnce()
    await rerender({ icon: 'plus', label: 'Add', onclick, disabled: true })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onclick).toHaveBeenCalledOnce()
  })

  it('says when it is on, for a toggle such as a layer`s eye', () => {
    render(IconButton, { icon: 'eye', label: 'Show Sky', pressed: true })
    expect(screen.getByRole('button', { name: 'Show Sky' })).toHaveAttribute('aria-pressed', 'true')
  })
})
