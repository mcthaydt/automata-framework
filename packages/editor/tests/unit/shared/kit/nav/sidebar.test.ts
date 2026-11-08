// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from '#src/shared/kit/nav/Sidebar.svelte'
import TabBar from '#src/shared/kit/nav/TabBar.svelte'

const ENTRIES = ['tuner', 'studio', 'audio', 'feel', 'writer', 'levels'].map((id) => ({
  id,
  label: id[0]?.toUpperCase() + id.slice(1),
  icon: 'home' as const,
}))
const game = { name: 'Rooftops', letter: 'R' }

describe('Sidebar', () => {
  it('names the game, offers Home as a button outside the editors, and names each tab by the editor alone', () => {
    render(Sidebar, { game, entries: ENTRIES, current: 'audio', layout: 'sidebar', onselect: () => {}, onhome: () => {} })
    expect(screen.getByText('Rooftops')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(ENTRIES.map((entry) => entry.label))
  })

  it('Home is the current page only when no editor is open, and calls onhome', async () => {
    const onhome = vi.fn()
    render(Sidebar, { game, entries: ENTRIES, current: undefined, layout: 'rail', onselect: () => {}, onhome })
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onhome).toHaveBeenCalledOnce()
  })

  it('draws a count of problems at the row, described but not part of the tab name', () => {
    render(Sidebar, {
      game,
      entries: ENTRIES,
      current: 'tuner',
      counts: { levels: 2 },
      layout: 'sidebar',
      onselect: () => {},
      onhome: () => {},
    })
    const levels = screen.getByRole('tab', { name: 'Levels' })
    expect(levels).toHaveAccessibleDescription('2 problems')
    expect(screen.getByRole('tab', { name: 'Tuner' })).not.toHaveAccessibleDescription()
  })
})

describe('TabBar', () => {
  it('shows four tabs and More, and More lists the rest by name', async () => {
    const onselect = vi.fn()
    render(TabBar, { entries: ENTRIES, current: 'tuner', standing: false, onselect })
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.click(screen.getByRole('button', { name: 'Levels' }))
    expect(onselect).toHaveBeenCalledWith('levels')
  })

  it('stands vertical when the phone is held sideways and lies horizontal otherwise', () => {
    const { rerender } = render(TabBar, { entries: ENTRIES, current: 'tuner', standing: true, onselect: () => {} })
    expect(screen.getByRole('tablist', { name: 'Editors' })).toHaveAttribute('aria-orientation', 'vertical')
    rerender({ standing: false })
    return vi.waitFor(() =>
      expect(screen.getByRole('tablist', { name: 'Editors' })).toHaveAttribute('aria-orientation', 'horizontal'),
    )
  })
})
