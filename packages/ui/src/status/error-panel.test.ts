import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorPanel from './ErrorPanel.svelte'

describe('ErrorPanel', () => {
  it('interrupts with the message, marked with its code', () => {
    render(ErrorPanel, {
      code: 'download',
      message: "Couldn't download the game.",
      actions: [{ id: 'retry', label: 'Try again', kind: 'primary', onSelect: vi.fn() }],
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Couldn't download the game.")
    expect(alert).toHaveAttribute('data-code', 'download')
    // Where the keyboard leaves less room than it needs, it scrolls its own content (spec §3.4).
    expect(alert).toHaveAttribute('data-scroll-region')
  })

  it('offers each way forward, primary first, and calls it', async () => {
    const retry = vi.fn()
    const dismiss = vi.fn()
    render(ErrorPanel, {
      code: 'progress',
      message: "Couldn't load your progress.",
      actions: [
        { id: 'retry', label: 'Try again', kind: 'primary', onSelect: retry },
        { id: 'continue', label: 'Continue without loading', kind: 'secondary', onSelect: dismiss },
      ],
    })
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Try again', 'Continue without loading'])
    expect(buttons[0]).toHaveClass('af-control--primary')
    expect(buttons[0]).toHaveAttribute('data-kind', 'primary')
    expect(buttons[1]).toHaveAttribute('data-kind', 'secondary')
    await userEvent.click(buttons[0] as HTMLElement)
    await userEvent.click(buttons[1] as HTMLElement)
    expect(retry).toHaveBeenCalledOnce()
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('refuses to draw a failure with no way forward, unless it is final', () => {
    expect(() => render(ErrorPanel, { code: 'x', message: 'Broken.', actions: [] })).toThrow(/way forward/)
    render(ErrorPanel, {
      code: 'unsupported',
      message: "This device can't run the game.",
      actions: [],
      final: true,
    })
    expect(screen.getByRole('alert')).toHaveTextContent("This device can't run the game.")
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
