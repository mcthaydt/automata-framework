import { fakeHosting } from '@automataframework/framework/testing'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreditsPanel from '#src/features/credits/CreditsPanel.svelte'
import type { Credits } from '#src/shared/credits/credits.schema.ts'

// The credits panel: core's Modal around sections of names. A name with a link is a button only where the host
// granted `links`; pressing it asks the host, never the page. A refusal is said, politely, with the panel left open.

afterEach(cleanup)

const CREDITS: Credits = {
  sections: [
    {
      title: 'Game',
      names: [
        { name: 'Ada', role: 'Design', url: 'https://ada.test' },
        { name: 'Bo', role: 'Code' },
      ],
    },
    { title: 'Music', names: [{ name: 'Cy', url: 'https://cy.test' }] },
  ],
}
const COPY = {
  title: 'Credits',
  close: 'Close',
  opens: (name: string) => `Open ${name}’s page`,
  refused: 'That page could not be opened.',
}

function open(
  options: { links?: 'open' | 'refuse'; granted?: boolean; credits?: Credits; onClose?: () => void } = {},
) {
  const fake = fakeHosting({
    links: options.links ?? 'open',
    ...(options.granted === false ? { granted: ['lifecycle' as const] } : {}),
  })
  const hosting = fake.create({ gameId: 'g', wants: ['links'], pauseBehavior: 'pause' })
  const onClose = options.onClose ?? vi.fn()
  render(CreditsPanel, { credits: options.credits ?? CREDITS, copy: COPY, onClose, hosting })
  return { fake, hosting, onClose }
}

describe('CreditsPanel', () => {
  it('shows the sections and names in the order given, with roles', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Credits' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Game', 'Music'])
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text.indexOf('Ada')).toBeLessThan(text.indexOf('Bo'))
    expect(text.indexOf('Bo')).toBeLessThan(text.indexOf('Cy'))
    expect(screen.getByText('Design')).toBeInTheDocument()
  })

  it('a link calls hosting.openLink with the url', async () => {
    const { fake } = open()
    await fireEvent.click(screen.getByRole('button', { name: 'Open Ada’s page' }))
    await waitFor(() => expect(fake.control.opened).toEqual(['https://ada.test']))
  })

  it('a name without a link is plain text', () => {
    open()
    expect(screen.queryByRole('button', { name: 'Open Bo’s page' })).toBeNull()
    expect(screen.getByText('Bo')).toBeInTheDocument()
  })

  it('a refused link says so, politely, and the panel stays open', async () => {
    const { onClose } = open({ links: 'refuse' })
    expect(screen.queryByText(COPY.refused)).toBeNull()
    await fireEvent.click(screen.getByRole('button', { name: 'Open Ada’s page' }))
    const note = await screen.findByText(COPY.refused)
    expect(note.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('the refusal goes away when the next link opens', async () => {
    const { fake } = open({ links: 'refuse' })
    await fireEvent.click(screen.getByRole('button', { name: 'Open Ada’s page' }))
    await screen.findByText(COPY.refused)
    fake.control.answerLinks('open')
    await fireEvent.click(screen.getByRole('button', { name: 'Open Cy’s page' }))
    await waitFor(() => expect(screen.queryByText(COPY.refused)).toBeNull())
  })

  it('without the links grant a link is plain text: no button, no anchor', () => {
    open({ granted: false })
    expect(screen.queryByRole('button', { name: /Open/ })).toBeNull()
    expect(document.querySelector('a')).toBeNull()
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })

  it('never opens a window or touches the page’s location itself', async () => {
    const opener = vi.spyOn(window, 'open')
    open()
    await fireEvent.click(screen.getByRole('button', { name: 'Open Ada’s page' }))
    expect(opener).not.toHaveBeenCalled()
    opener.mockRestore()
  })

  it('Escape and Close call onClose', async () => {
    const onClose = vi.fn()
    open({ onClose })
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('Close is marked as a back sound', () => {
    open()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('data-sfx', 'back')
  })

  it('takes translated titles and roles from the game’s lookup', () => {
    const fake = fakeHosting({})
    render(CreditsPanel, {
      credits: CREDITS,
      copy: COPY,
      onClose: () => {},
      hosting: fake.create({ gameId: 'g', wants: [], pauseBehavior: 'pause' }),
      text: (section: number, name: number | undefined, authored: string) =>
        name === undefined ? `S${section}:${authored}` : `N${section}.${name}:${authored}`,
    })
    expect(screen.getByRole('heading', { name: 'S0:Game' })).toBeInTheDocument()
    expect(screen.getByText('N0.0:Design')).toBeInTheDocument()
    // A name is a person's, so the lookup is never asked to translate it.
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })
})
