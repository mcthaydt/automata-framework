// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ToolRail from '#src/features/levels-3d/plan/ToolRail.svelte'

// The Plan view's tool rail (plan ED3D.6g-a step 6; ED3D spec §9, §10): one button per tool, the active one pressed,
// each naming its key.

describe('ToolRail', () => {
  it('shows each tool with its key, the active one pressed; Polygon and Rectangle both press Room', () => {
    render(ToolRail, { active: 'rectangle', onchoose: vi.fn() })
    for (const [name, key] of [
      ['Select', 'V'],
      ['Room', 'S'],
      ['Corner', 'X'],
      ['Doorway', 'P'],
      ['Door', 'D'],
      ['Window', 'N'],
      ['Thing', 'T'],
    ] as const)
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-keyshortcuts', key)
    expect(screen.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('chooses a tool on a press; Room chooses the polygon', async () => {
    const onchoose = vi.fn()
    render(ToolRail, { active: 'select', onchoose })
    await userEvent.click(screen.getByRole('button', { name: 'Door' }))
    await userEvent.click(screen.getByRole('button', { name: 'Room' }))
    expect(onchoose.mock.calls).toEqual([['door'], ['polygon']])
  })

  it('draws an icon beside each name and keeps the name in words, so no tool is a guess', () => {
    const { container } = render(ToolRail, { active: 'select', onchoose: vi.fn() })
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons).toHaveLength(7)
    for (const button of buttons) {
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      expect(button.textContent?.trim()).not.toBe('')
    }
  })

  it('keeps Room pressed while Split or Merge is the tool', () => {
    render(ToolRail, { active: 'merge', onchoose: vi.fn() })
    expect(screen.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true')
  })
})
