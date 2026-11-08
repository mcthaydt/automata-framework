// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LevelCard } from '#src/features/level/dock-model.ts'
import LevelDock from '#src/features/level/LevelDock.svelte'

// The dock of level cards: one 44 px card per level, the open one marked; a tap opens the level
// and focus stays on the card, so a keyboard or switch user keeps their place.

const cards = (current: string): readonly LevelCard[] => [
  { id: 'level-1', name: 'Level 1', size: { w: 512, h: 288 }, current: current === 'level-1' },
  { id: 'level-2', name: 'Cave', size: { w: 256, h: 144 }, current: current === 'level-2' },
]

describe('LevelDock', () => {
  it('shows each level with its size, the open one current', () => {
    render(LevelDock, { cards: cards('level-1'), onopen: vi.fn() })
    const first = screen.getByRole('button', { name: /Level 1/ })
    expect(first).toHaveAttribute('aria-current', 'true')
    expect(first).toHaveTextContent('512 × 288')
    expect(screen.getByRole('button', { name: /Cave/ })).not.toHaveAttribute('aria-current')
  })

  it('opens a level on a tap and keeps focus on its card', async () => {
    const onopen = vi.fn()
    const view = render(LevelDock, { cards: cards('level-1'), onopen })
    await userEvent.setup().click(screen.getByRole('button', { name: /Cave/ }))
    expect(onopen).toHaveBeenCalledWith('level-2')
    await view.rerender({ cards: cards('level-2'), onopen })
    const cave = screen.getByRole('button', { name: /Cave/ })
    expect(cave).toHaveAttribute('aria-current', 'true')
    expect(cave).toHaveFocus()
  })
})
