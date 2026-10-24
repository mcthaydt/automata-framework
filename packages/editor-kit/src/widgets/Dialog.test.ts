import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import DialogFixture from '../testing/DialogFixture.svelte'

function mount(props: Record<string, unknown> = {}) {
  const onclose = vi.fn()
  render(DialogFixture, { onclose, ...props })
  return { onclose }
}

const opener = (): HTMLElement => screen.getByRole('button', { name: 'Open' })
const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Delete layer' })

describe('Dialog', () => {
  test('renders nothing while closed', () => {
    mount()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('open, it is a modal dialog named by its title, with its content and actions', async () => {
    mount()
    await userEvent.click(opener())
    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(dialog()).toHaveTextContent('Its 14 tiles go with it.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  test('focus goes to the first focusable thing, or to [data-autofocus] when there is one', async () => {
    mount()
    await userEvent.click(opener())
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveFocus()
  })

  test('data-autofocus wins', async () => {
    mount({ autofocus: true })
    await userEvent.click(opener())
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
  })

  test('Tab and Shift+Tab stay inside the dialog', async () => {
    mount()
    await userEvent.click(opener())
    const first = screen.getByRole('textbox', { name: 'Reason' })
    const last = screen.getByRole('button', { name: 'Delete' })
    last.focus()
    await userEvent.tab()
    expect(first).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  test('Escape closes with the reason and returns focus to the opener', async () => {
    const { onclose } = mount()
    await userEvent.click(opener())
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledWith('escape')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  test('pressing the scrim closes it; pressing inside does not', async () => {
    const { onclose } = mount()
    await userEvent.click(opener())
    await userEvent.click(dialog())
    expect(screen.queryByRole('dialog')).not.toBeNull()
    await userEvent.click(document.querySelector('[data-dialog-root]') as HTMLElement)
    expect(onclose).toHaveBeenCalledWith('scrim')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('an action closes it with the reason action', async () => {
    const { onclose } = mount()
    await userEvent.click(opener())
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onclose).toHaveBeenCalledWith('action')
    expect(opener()).toHaveFocus()
  })

  test('a dialog that is not dismissible ignores Escape and the scrim', async () => {
    const { onclose } = mount({ dismissible: false })
    await userEvent.click(opener())
    await userEvent.keyboard('{Escape}')
    await userEvent.click(document.querySelector('[data-dialog-root]') as HTMLElement)
    expect(onclose).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  test('closed by its owner instead (the binding flips), it still gives focus back', async () => {
    const { onclose } = mount()
    await userEvent.click(opener())
    await userEvent.click(screen.getByRole('button', { name: 'Close from outside' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onclose).not.toHaveBeenCalled()
    expect(opener()).toHaveFocus()
  })

  test('a dialog that starts open takes focus on mount', () => {
    mount({ startOpen: true })
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveFocus()
  })
})
