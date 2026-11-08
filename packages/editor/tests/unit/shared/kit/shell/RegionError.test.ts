// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import RegionError from '#src/shared/kit/shell/RegionError.svelte'

const setClipboard = (clipboard: { writeText(text: string): Promise<void> } | undefined): void => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
}

const broken = (): Error => {
  const error = new Error('layer list exploded')
  error.stack = 'Error: layer list exploded\n    at LayerList'
  return error
}

const panel = (): HTMLElement => document.querySelector('[data-region-error]') as HTMLElement

const details = (): HTMLTextAreaElement => screen.getByRole('textbox', { name: 'Error details' })

afterEach(() => setClipboard(undefined))

describe('RegionError', () => {
  test('says which region stopped and shows the details as selectable text', () => {
    render(RegionError, { region: 'panel', error: broken(), layout: 'block' })
    expect(panel()).toHaveAttribute('data-region-error', 'panel')
    expect(panel()).toHaveAttribute('data-layout', 'block')
    // Only the message is the alert, so a screen reader hears it once, not the button, details and note with it.
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/^The panel stopped working\.$/)
    expect(alert).not.toContainElement(screen.getByRole('status'))
    expect(alert).not.toContainElement(details())
    expect(details()).toHaveAttribute('readonly')
    expect(details().value).toContain('Region: panel')
    expect(details().value).toContain('Error: Error: layer list exploded')
    expect(details().value).toContain('at LayerList')
    expect(screen.getByRole('button', { name: 'Copy details' })).toHaveTextContent('Copy details')
  })

  test('Copy details puts the details on the clipboard and says so', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    setClipboard({ writeText })
    render(RegionError, { region: 'status', error: broken(), layout: 'bar' })
    await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
    expect(writeText).toHaveBeenCalledWith(details().value)
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  test.each([
    ['there is no clipboard', undefined],
    [
      'the clipboard refuses',
      {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    ],
  ])('when %s, selects the details for the system Copy and says so', async (_case, clipboard) => {
    setClipboard(clipboard)
    render(RegionError, { region: 'canvas', error: broken(), layout: 'block' })
    await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy is not available here: the details are selected.',
    )
    expect(document.activeElement).toBe(details())
    expect(details().selectionStart).toBe(0)
    expect(details().selectionEnd).toBe(details().value.length)
  })

  test('sets the selection range itself, since iOS Safari ignores select() on a read-only box', async () => {
    setClipboard(undefined)
    const select = vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(() => {})
    try {
      render(RegionError, { region: 'canvas', error: broken(), layout: 'block' })
      await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
      expect(details().selectionStart).toBe(0)
      expect(details().selectionEnd).toBe(details().value.length)
    } finally {
      select.mockRestore()
    }
  })

  test('a second Copy clears "Copied" until it is done', async () => {
    let finish: () => void = () => {}
    const writeText = vi.fn(async (_text: string) => {})
    setClipboard({ writeText })
    render(RegionError, { region: 'status', error: broken(), layout: 'bar' })
    const button = screen.getByRole('button', { name: 'Copy details' })
    await userEvent.click(button)
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
    await userEvent.click(button)
    expect(screen.getByRole('status').textContent).toBe('')
    finish()
    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied'))
  })

  test('the note clears when focus leaves the panel, but not when it moves to the details', async () => {
    setClipboard({ writeText: async () => {} })
    render(RegionError, { region: 'panel', error: broken(), layout: 'block' })
    const outside = document.createElement('button')
    document.body.append(outside)
    await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
    await userEvent.click(details())
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    await userEvent.click(outside)
    expect(screen.getByRole('status').textContent).toBe('')
    outside.remove()
  })

  test('shows a thrown value that is not an Error', () => {
    render(RegionError, { region: 'topbar', error: 'gone', layout: 'bar' })
    expect(screen.getByRole('alert')).toHaveTextContent('The top bar stopped working.')
    expect(details().value).toBe('Region: topbar\nError: gone')
  })
})
