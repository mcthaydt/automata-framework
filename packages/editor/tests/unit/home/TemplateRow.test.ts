// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TemplateCard } from '#src/features/home/home-model.ts'
import TemplateRow from '#src/features/home/TemplateRow.svelte'

// The cards are made up here on purpose: the row draws whatever cards it is given and knows no profile.
const roguelike: TemplateCard = {
  key: 'dungeon/rogue',
  profileId: 'dungeon',
  profileLabel: 'Dungeon',
  id: 'rogue',
  label: 'Roguelike',
  hint: 'rooms · loot',
  tagged: false,
}
const blank: TemplateCard = {
  ...roguelike,
  key: 'dungeon/blank',
  id: 'blank',
  label: 'Blank',
  hint: undefined,
}

function mount(cards: readonly TemplateCard[], busy = false) {
  const oncreate = vi.fn()
  render(TemplateRow, { cards, busy, oncreate })
  return { oncreate }
}

describe('TemplateRow', () => {
  it('is a list of templates with one button for each, with its hint', () => {
    mount([roguelike, blank])
    expect(screen.getByRole('list', { name: 'Templates' })).toBeInTheDocument()
    const rogue = screen.getByRole('button', { name: /Roguelike/ })
    expect(rogue).toHaveTextContent('rooms · loot')
    expect(screen.getByRole('button', { name: /Blank/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('names the profile on a card only when the card says to', () => {
    mount([{ ...roguelike, tagged: true }, blank])
    expect(within(screen.getByRole('button', { name: /Roguelike/ })).getByText('Dungeon')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Blank/ })).queryByText('Dungeon')).toBeNull()
  })

  it('asks for a new project from the profile and the template it was pressed on', async () => {
    const { oncreate } = mount([roguelike, { ...blank, profileId: 'other' }])
    await userEvent.click(screen.getByRole('button', { name: /Blank/ }))
    expect(oncreate).toHaveBeenCalledWith('other', 'blank')
  })

  it('tells apart two profiles that both have a template of the same id', () => {
    mount([
      { ...roguelike, key: 'dungeon/blank', profileId: 'dungeon', id: 'blank', label: 'Blank dungeon' },
      { ...roguelike, key: 'maze/blank', profileId: 'maze', id: 'blank', label: 'Blank maze' },
    ])
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('while a project is being made every card stays, disabled', async () => {
    const { oncreate } = mount([roguelike, blank], true)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).toBeDisabled()
    await userEvent.click(buttons[0] as HTMLElement)
    expect(oncreate).not.toHaveBeenCalled()
  })
})
