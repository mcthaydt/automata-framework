// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SuiteRail from '#src/features/suite/shell/SuiteRail.svelte'
import { type SuiteEntry, suiteEntries } from '#src/features/suite/shell/suite-entries.ts'

// The switcher: one tab per entry, one tab stop, arrows within it, Cmd or Ctrl 1 to 9 from anywhere. These tests use
// nine entries, as many as the shortcuts reach; the 2D suite page has two.
const NAMES = ['Tuner', 'Studio', 'Audio', 'Feel', 'Writer', 'Schematic', 'Sequence', 'Levels']
const SUITE_ENTRIES: readonly SuiteEntry[] = suiteEntries(
  NAMES.map((label) => ({ id: label.toLowerCase(), label })),
)
const tabs = () => screen.getAllByRole('tab')

describe('SuiteRail', () => {
  it('shows the nine entries as tabs, the chosen one selected and the only tab stop', () => {
    render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'audio',
      presentation: 'sidebar',
      onselect: () => {},
    })
    expect(screen.getByRole('tablist', { name: 'Editors' })).toHaveAttribute('aria-orientation', 'vertical')
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(SUITE_ENTRIES.map((entry) => entry.label))
    expect(screen.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true')
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toEqual([screen.getByRole('tab', { name: 'Audio' })])
  })

  it('draws each tab as its icon above its name, the name the tab is called by', () => {
    render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'tuner',
      presentation: 'sidebar',
      onselect: () => {},
    })
    for (const tab of tabs()) {
      expect(tab.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(tab.querySelector('.label')?.textContent?.trim()).toBe(tab.textContent?.trim())
    }
  })

  it('on Home no tab is selected and the first is the tab stop', () => {
    render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: undefined,
      presentation: 'tabbar',
      onselect: () => {},
    })
    expect(tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true')).toEqual([])
    expect(tabs()[0]?.tabIndex).toBe(0)
  })

  it('a tap chooses an entry', async () => {
    const onselect = vi.fn()
    render(SuiteRail, { entries: SUITE_ENTRIES, current: undefined, presentation: 'sidebar', onselect })
    await userEvent.click(screen.getByRole('tab', { name: 'Levels' }))
    expect(onselect).toHaveBeenCalledWith('levels')
  })

  it('arrows, Home and End move along the rail and wrap; the horizontal bar uses left and right', async () => {
    const onselect = vi.fn()
    const { rerender } = render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'tuner',
      presentation: 'sidebar',
      onselect,
    })
    screen.getByRole('tab', { name: 'Tuner' }).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onselect).toHaveBeenLastCalledWith('levels')
    await userEvent.keyboard('{ArrowDown}')
    expect(onselect).toHaveBeenLastCalledWith('studio')
    await userEvent.keyboard('{End}')
    expect(onselect).toHaveBeenLastCalledWith('levels')
    await rerender({ presentation: 'tabbar', current: 'studio' })
    screen.getByRole('tab', { name: 'Studio' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onselect).toHaveBeenLastCalledWith('audio')
    await userEvent.keyboard('{Home}')
    expect(onselect).toHaveBeenLastCalledWith('tuner')
  })

  it('moves the focus with the choice', async () => {
    const { rerender } = render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'tuner',
      presentation: 'sidebar',
      onselect: () => {},
    })
    screen.getByRole('tab', { name: 'Tuner' }).focus()
    await rerender({ current: 'studio' })
    expect(screen.getByRole('tab', { name: 'Studio' })).toHaveFocus()
  })

  it('Cmd or Ctrl and a digit choose that entry from anywhere; other digits and plain digits do nothing', async () => {
    const onselect = vi.fn()
    render(SuiteRail, { entries: SUITE_ENTRIES, current: undefined, presentation: 'sidebar', onselect })
    await userEvent.keyboard('{Meta>}8{/Meta}')
    expect(onselect).toHaveBeenLastCalledWith('levels')
    await userEvent.keyboard('{Control>}1{/Control}')
    expect(onselect).toHaveBeenLastCalledWith('tuner')
    onselect.mockClear()
    await userEvent.keyboard('{Meta>}0{/Meta}9')
    expect(onselect).not.toHaveBeenCalled()
  })

  it('with two entries, Cmd 1 and 2 choose them and Cmd 3 does nothing', async () => {
    const onselect = vi.fn()
    const two = suiteEntries([
      { id: 'tuner', label: 'Tuner' },
      { id: 'levels-2d', label: 'Levels' },
    ])
    render(SuiteRail, { entries: two, current: undefined, presentation: 'sidebar', onselect })
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Tuner', 'Levels'])
    await userEvent.keyboard('{Meta>}2{/Meta}')
    expect(onselect).toHaveBeenLastCalledWith('levels-2d')
    await userEvent.keyboard('{Meta>}1{/Meta}')
    expect(onselect).toHaveBeenLastCalledWith('tuner')
    onselect.mockClear()
    await userEvent.keyboard('{Meta>}3{/Meta}')
    expect(onselect).not.toHaveBeenCalled()
  })
})
