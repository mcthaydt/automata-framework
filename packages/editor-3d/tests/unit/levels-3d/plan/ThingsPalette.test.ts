// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
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
})
