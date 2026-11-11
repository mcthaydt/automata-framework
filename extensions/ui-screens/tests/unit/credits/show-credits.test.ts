import { fakeHosting } from '@automata/framework/testing'
import { fireEvent, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showCredits } from '#src/app/show-credits.ts'
import { screensWords } from '#src/shared/words/screens-words.ts'

// `showCredits` is the panel for a game that is plain TypeScript and has no Svelte of its own to mount it with: it puts
// the panel in `target`, in the player's language unless the game passes words, and hands back how to close it.

afterEach(() => document.body.replaceChildren())

const credits = {
  sections: [{ title: 'Game', names: [{ name: 'Ada', role: 'Design', url: 'https://ada.test' }] }],
}
const hosting = () => fakeHosting({}).create({ gameId: 'g', wants: ['links'], pauseBehavior: 'pause' })

describe('showCredits', () => {
  it('shows the panel in the target, in the words of the locale it is given', () => {
    const target = document.body.appendChild(document.createElement('div'))
    showCredits({ target, credits, hosting: hosting(), locale: 'ja' })
    expect(screen.getByRole('dialog', { name: screensWords('ja').credits.title })).toBeInTheDocument()
    expect(target.querySelector('[data-testid="credits-panel"]')).not.toBeNull()
  })

  it('takes the game’s own words over the package’s', () => {
    const target = document.body.appendChild(document.createElement('div'))
    showCredits({
      target,
      credits,
      hosting: hosting(),
      copy: { title: 'Thanks', close: 'Done', opens: (name) => `Visit ${name}`, refused: 'No.' },
    })
    expect(screen.getByRole('dialog', { name: 'Thanks' })).toBeInTheDocument()
  })

  it('close removes the panel, calls onClose once, and may be called again', () => {
    const target = document.body.appendChild(document.createElement('div'))
    const onClose = vi.fn()
    const shown = showCredits({ target, credits, hosting: hosting(), onClose })
    shown.close()
    shown.close()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape and the Close button close it and call onClose', async () => {
    const target = document.body.appendChild(document.createElement('div'))
    const onClose = vi.fn()
    showCredits({ target, credits, hosting: hosting(), onClose })
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
