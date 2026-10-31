import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorScreen from './ErrorScreen.svelte'

// PRODUCT.6: the error screen is core's ErrorPanel on the ui frame. Every failure names a way forward: an action, or, when the
// device cannot run the game at all (`final`), the screen's Back.

afterEach(cleanup)
const retry = vi.fn()
const props = (over: Record<string, unknown> = {}) => ({
  code: 'save-failed',
  message: 'The save could not be written.',
  actions: [
    { id: 'retry', label: 'Try again', kind: 'primary' as const, onSelect: retry },
    { id: 'skip', label: 'Continue without saving', kind: 'secondary' as const, onSelect: () => {} },
  ],
  ...over,
})

describe('ErrorScreen', () => {
  it('shows the message as an alert', () => {
    render(ErrorScreen, props())
    expect(screen.getByRole('alert')).toHaveTextContent('The save could not be written.')
  })

  it('runs the action chosen', async () => {
    render(ErrorScreen, props())
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('focuses the primary action on entry', () => {
    render(ErrorScreen, props())
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
  })

  it('offers Back when the game gives a way back, and goes back on Escape', async () => {
    const onBack = vi.fn()
    render(ErrorScreen, props({ onBack, backLabel: 'Back' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('has no Back when the game gives none', () => {
    render(ErrorScreen, props())
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('lets a final failure stand with Back as its way out', () => {
    render(ErrorScreen, props({ final: true, actions: [], onBack: () => {}, backLabel: 'Back' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('refuses a final failure with no Back, and a failure with no way forward', () => {
    expect(() => render(ErrorScreen, props({ final: true, actions: [] }))).toThrow(/Back/)
    expect(() => render(ErrorScreen, props({ actions: [] }))).toThrow(/way forward/)
  })
})
