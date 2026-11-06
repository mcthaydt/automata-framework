import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, test } from 'vitest'
import StatusLine from './StatusLine.svelte'

const pill = (): HTMLElement => document.querySelector('[data-save]') as HTMLElement

describe('StatusLine', () => {
  test.each([
    ['saved', 'Saved'],
    ['dirty', 'Unsaved changes'],
    ['saving', 'Saving…'],
    ['error', 'Save failed'],
    ['device', 'Not saved on this device'],
  ] as const)('the %s state reads "%s"', (save, text) => {
    render(StatusLine, { save })
    expect(pill()).toHaveTextContent(text)
    expect(pill()).toHaveAttribute('data-save', save)
  })

  test('shows the message, and nothing when there is none', async () => {
    const { rerender } = render(StatusLine, { save: 'saved', message: 'Tile 12 × 4 selected' })
    expect(screen.getByRole('status')).toHaveTextContent('Tile 12 × 4 selected')
    await rerender({ save: 'saved', message: undefined })
    expect(screen.getByRole('status').textContent).toBe('')
  })

  test('draws what the editor puts beside the message', () => {
    const children = createRawSnippet(() => ({ render: () => '<span>x 12, y 40</span>' }))
    render(StatusLine, { save: 'saved', children })
    expect(screen.getByText('x 12, y 40')).toBeInTheDocument()
  })

  test('only a failed or device-only save is announced when it changes', async () => {
    const { rerender } = render(StatusLine, { save: 'saving' })
    expect(pill()).toHaveAttribute('aria-live', 'off')
    await rerender({ save: 'error' })
    expect(pill()).toHaveAttribute('aria-live', 'polite')
    await rerender({ save: 'device' })
    expect(pill()).toHaveAttribute('aria-live', 'polite')
    await rerender({ save: 'saved' })
    expect(pill()).toHaveAttribute('aria-live', 'off')
  })
})
