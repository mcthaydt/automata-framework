// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ThingsPalette from '#src/features/levels-3d/plan/ThingsPalette.svelte'
import type { PaletteEntry } from '#src/features/levels-3d/things/things-tool-controller.ts'

// The Things tool's palette (plan ED3D.7d step 5; ED3D spec §4.7): the level's definitions, the picked one marked, one
// on a hidden or locked layer saying why it cannot be picked.

const entry = (def: string, more: Partial<PaletteEntry> = {}): PaletteEntry => ({
  def,
  label: def,
  shape: 'point',
  color: '#cc8844',
  group: 'things',
  layer: `things:${def}`,
  hidden: false,
  locked: false,
  ...more,
})

describe('ThingsPalette', () => {
  it('lists the definitions, marks the picked one, and picks on a press', async () => {
    const onpick = vi.fn()
    render(ThingsPalette, { palette: [entry('spawn'), entry('crate')], active: 'crate', onpick })
    expect(screen.getByRole('button', { name: 'crate' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'spawn' }))
    expect(onpick).toHaveBeenCalledWith('spawn')
  })

  it('says why a definition on a hidden or locked layer cannot be picked', async () => {
    const onpick = vi.fn()
    render(ThingsPalette, {
      palette: [entry('spawn', { hidden: true }), entry('crate', { locked: true })],
      active: undefined,
      onpick,
    })
    expect(screen.getByRole('button', { name: 'spawn' })).toHaveAccessibleDescription('Its layer is hidden')
    expect(screen.getByRole('button', { name: 'crate' })).toHaveAccessibleDescription('Its layer is locked')
    await userEvent.click(screen.getByRole('button', { name: 'crate' }))
    expect(onpick).not.toHaveBeenCalled()
  })

  it('files the game’s furniture and characters under their own names, in words, never by id', () => {
    render(ThingsPalette, {
      palette: [
        entry('ember', { label: 'Ember' }),
        entry('prop.barrel', { label: 'Barrel', group: 'furniture' }),
        entry('prop.crate', { label: 'Crate', group: 'furniture' }),
        entry('cast.wick', { label: 'Wick', group: 'characters' }),
      ],
      active: undefined,
      onpick: vi.fn(),
    })
    const groups = screen
      .getAllByRole('group')
      .filter((each) => each.getAttribute('aria-label') !== 'Things to place')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Things',
      'Furniture',
      'Characters',
    ])
    expect(
      within(groups[1] as HTMLElement)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim()),
    ).toEqual(['Barrel', 'Crate'])
    expect(screen.queryByText(/prop\./)).toBeNull()
  })

  it('offers the lamps under their own name, after the characters', () => {
    render(ThingsPalette, {
      palette: [
        entry('cast.wick', { label: 'Wick', group: 'characters' }),
        entry('lamp.pendant', { label: 'Pendant lamp', group: 'lamps' }),
      ],
      active: undefined,
      onpick: vi.fn(),
    })
    const groups = screen
      .getAllByRole('group')
      .filter((each) => each.getAttribute('aria-label') !== 'Things to place')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['Characters', 'Lamps'])
    expect(screen.getByRole('button', { name: 'Pendant lamp' })).toBeInTheDocument()
  })

  it('says nothing of groups when the level has only its own things', () => {
    render(ThingsPalette, { palette: [entry('spawn')], active: undefined, onpick: vi.fn() })
    expect(screen.queryByText('Things')).toBeNull()
  })
})
