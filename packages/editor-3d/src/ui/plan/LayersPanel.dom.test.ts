import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LayerRow } from '../../app/layers-model'
import LayersPanel from './LayersPanel.svelte'

// The layers panel (plan ED3D.5d step 4; ED3D spec §5.2, §9): a row per layer with Show or Hide and Lock or Unlock,
// named for what they do; choosing a row makes it the layer the tools work on.

const base = { count: 0, depth: 0, hidden: false, locked: false, active: false, inherited: false } as const
const rows: LayerRow[] = [
  { ...base, id: 'sectors', label: 'Sectors', color: '#cfd3dc', count: 3, active: true },
  { ...base, id: 'walls', label: 'Walls', color: '#5aa9e6', count: 12, hidden: true },
  { ...base, id: 'things', label: 'Things', color: '#8f9bb3', count: 2, locked: true },
  { ...base, id: 'things:lamp', label: 'Lamps', color: '#f4e285', count: 2, depth: 1, inherited: true },
]

function mount() {
  const handlers = { ontoggle: vi.fn(), onactivate: vi.fn() }
  render(LayersPanel, { rows, ...handlers })
  return handlers
}

const rowOf = (label: string): HTMLElement => {
  const row = screen.getByText(label).closest('[data-layer]')
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${label}`)
  return row
}

describe('LayersPanel', () => {
  it('lists each layer with its count, the active one marked', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeInTheDocument()
    expect(within(rowOf('Sectors')).getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sectors' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Walls' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('names the toggles for what a press does, and says when they are on', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Hide Sectors' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Show Walls' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Unlock Things' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Lock Sectors' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('hides, locks and chooses through its handlers', async () => {
    const { ontoggle, onactivate } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Show Walls' }))
    expect(ontoggle).toHaveBeenCalledWith('hidden', 'walls')
    await userEvent.click(screen.getByRole('button', { name: 'Lock Lamps' }))
    expect(ontoggle).toHaveBeenCalledWith('locked', 'things:lamp')
    await userEvent.click(screen.getByRole('button', { name: 'Walls' }))
    expect(onactivate).toHaveBeenCalledWith('walls')
  })

  it('says a sub-layer is off with Things', () => {
    mount()
    expect(rowOf('Lamps')).toHaveAttribute('data-inherited', 'true')
    expect(within(rowOf('Lamps')).getByText('Off with Things')).toBeInTheDocument()
  })
})
