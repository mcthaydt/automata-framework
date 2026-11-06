import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dialog from '#src/shared/ui/dialog/Dialog.svelte'
import { textSnippet } from '#src/testing/fixtures/text-snippet.ts'
import Harness from '../../../../fixtures/shared/ui/dialog/DialogHarness.test.svelte'
import Stack from '../../../../fixtures/shared/ui/dialog/DialogStack.test.svelte'

// Ported from Ruken packages/ui/src/Dialog.svelte.test.ts at b30d31b.
async function openDialog(props: Record<string, unknown> = {}) {
  const onclose = vi.fn()
  const onexit = vi.fn()
  render(Harness, { onclose, onexit, ...props })
  const trigger = screen.getByRole('button', { name: 'Leave' })
  await userEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Leave the game?' })
  return { dialog, trigger, onclose, onexit }
}

describe('Dialog', () => {
  it('is a modal dialog named by its title and described by its text, with its actions', async () => {
    const { dialog } = await openDialog()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Your progress is saved.')
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave game' })).toBeInTheDocument()
  })

  it('declares its body a scroll region, so its actions stay reachable on a short screen', async () => {
    const { dialog } = await openDialog()
    expect(dialog.querySelector('[data-scroll-region]')).toHaveTextContent('Your progress is saved.')
  })

  it('takes initial focus on the marked action, else the first control, else itself', async () => {
    await openDialog()
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus()
  })

  it('takes initial focus on the first control when none is marked', async () => {
    await openDialog({ markInitialFocus: false })
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus()
  })

  it('takes focus itself when it has nothing to press, and holds it on Tab', async () => {
    render(Dialog, { title: 'Heads up', onclose: vi.fn(), children: textSnippet('Nothing to do here.') })
    const dialog = screen.getByRole('dialog', { name: 'Heads up' })
    expect(dialog).toHaveFocus()
    await userEvent.tab()
    expect(dialog).toHaveFocus()
  })

  it('closes on Escape (calls onclose once), and ignores Escape while closed', async () => {
    const { onclose, onexit } = await openDialog()
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledOnce()
    expect(onexit).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('wraps Tab and Shift+Tab inside itself', async () => {
    await openDialog()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Leave game' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Leave game' })).toHaveFocus()
  })

  it('pulls focus back in when something outside takes it', async () => {
    await openDialog()
    screen.getByRole('button', { name: 'Elsewhere on the page' }).focus()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus())
  })

  it('gives focus back to its opener when it closes, by Escape or by an action', async () => {
    const first = await openDialog()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(first.trigger).toHaveFocus())
    await userEvent.click(first.trigger)
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Leave game' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(first.trigger).toHaveFocus()
    expect(first.onexit).toHaveBeenCalledOnce()
  })

  it('makes the page behind it inert while open, and gives it back on close', async () => {
    const { onclose } = await openDialog()
    const behind = screen.getByText('Elsewhere on the page')
    expect(behind.closest('[inert]')).not.toBeNull()
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(behind.closest('[inert]')).toBeNull()
  })

  it('only the topmost of stacked dialogs answers Escape', async () => {
    const onfirstclose = vi.fn()
    const onsecondclose = vi.fn()
    render(Stack, { onfirstclose, onsecondclose })
    await userEvent.click(screen.getByText('Discard run'))
    await screen.findByRole('dialog', { name: 'Discard this run?' })
    await userEvent.keyboard('{Escape}')
    expect(onsecondclose).toHaveBeenCalledOnce()
    expect(onfirstclose).not.toHaveBeenCalled()
  })
})
