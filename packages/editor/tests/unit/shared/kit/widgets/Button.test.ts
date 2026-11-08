// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import Button from '#src/shared/kit/widgets/Button.svelte'

const text = (label: string) => createRawSnippet(() => ({ render: () => `<span>${label}</span>` }))

describe('Button', () => {
  it('is a plain button that never submits a form', () => {
    render(Button, { children: text('Open') })
    const button = screen.getByRole('button', { name: 'Open' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-kind', 'secondary')
  })

  it('names its variant, so the stylesheet can size a primary action and mark a destructive one', () => {
    render(Button, { variant: 'primary', children: text('New') })
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('data-kind', 'primary')
  })

  it('calls onclick when pressed', async () => {
    const onclick = vi.fn()
    render(Button, { onclick, children: text('Open') })
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onclick).toHaveBeenCalledOnce()
  })

  it('does nothing when disabled, and stays in the page', async () => {
    const onclick = vi.fn()
    render(Button, { onclick, disabled: true, children: text('Open') })
    const button = screen.getByRole('button', { name: 'Open' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onclick).not.toHaveBeenCalled()
  })

  it('passes accessibility attributes through', () => {
    render(Button, { 'aria-label': 'Delete mossgate', title: 'Delete', children: text('×') })
    expect(screen.getByRole('button', { name: 'Delete mossgate' })).toHaveAttribute('title', 'Delete')
  })
})
