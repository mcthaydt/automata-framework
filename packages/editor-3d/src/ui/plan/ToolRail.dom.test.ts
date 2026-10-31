import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ToolRail from './ToolRail.svelte'

// The Plan view's tool rail (plan ED3D.6g-a step 6; ED3D spec §9, §10): one button per tool, the active one pressed,
// each naming its key; on a phone only Select, since compact is view and select.

describe('ToolRail', () => {
  it('shows each tool with its key, the active one pressed; Polygon and Rectangle both press Sector', () => {
    render(ToolRail, { active: 'rectangle', compact: false, onchoose: vi.fn() })
    for (const [name, key] of [
      ['Select', 'V'],
      ['Sector', 'S'],
      ['Vertex', 'X'],
      ['Portal', 'P'],
      ['Door', 'D'],
      ['Window', 'N'],
    ] as const)
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-keyshortcuts', key)
    expect(screen.getByRole('button', { name: 'Sector' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('chooses a tool on a press; Sector chooses the polygon', async () => {
    const onchoose = vi.fn()
    render(ToolRail, { active: 'select', compact: false, onchoose })
    await userEvent.click(screen.getByRole('button', { name: 'Door' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sector' }))
    expect(onchoose.mock.calls).toEqual([['door'], ['polygon']])
  })

  it('keeps Sector pressed while Split or Merge is the tool', () => {
    render(ToolRail, { active: 'merge', compact: false, onchoose: vi.fn() })
    expect(screen.getByRole('button', { name: 'Sector' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers only Select on a phone', () => {
    render(ToolRail, { active: 'select', compact: true, onchoose: vi.fn() })
    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Select'])
  })
})
