import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CornerControls from '#src/shared/ui/layout/CornerControls.svelte'
import { textSnippet } from '../../../../../src/testing/fixtures/text-snippet.ts'

describe('CornerControls', () => {
  it('shows Back only when the screen has somewhere to go back to', () => {
    render(CornerControls, { backLabel: 'Back' })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it("calls back with Back, named in the game's words", async () => {
    const back = vi.fn()
    render(CornerControls, { back, backLabel: 'Retour' })
    await userEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(back).toHaveBeenCalledOnce()
  })

  it('puts the header between the corners and the end controls at the end', () => {
    const { container } = render(CornerControls, {
      back: vi.fn(),
      backLabel: 'Back',
      header: textSnippet('Room ABCD'),
      end: textSnippet('Mute'),
    })
    const row = container.querySelector('[data-corner-controls]') as HTMLElement
    const [start, middle, end] = [...row.children]
    expect(start?.textContent).toContain('Back')
    expect(middle?.textContent).toBe('Room ABCD')
    expect(end?.textContent).toBe('Mute')
  })
})
