// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SuiteRail from '#src/features/suite/shell/SuiteRail.svelte'
import { SUITE_ENTRIES } from '#src/features/suite/shell/suite-entries.ts'

// The switcher (editor suite spec §10): nine tabs, one tab stop, arrows within it, Cmd or Ctrl 1 to 9 from anywhere.
const tabs = () => screen.getAllByRole('tab')

describe('SuiteRail', () => {
  it('shows the nine entries as tabs, the chosen one selected and the only tab stop', () => {
    render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'audio',
      orientation: 'vertical',
      onselect: () => {},
    })
    expect(screen.getByRole('tablist', { name: 'Editors' })).toHaveAttribute('aria-orientation', 'vertical')
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(SUITE_ENTRIES.map((entry) => entry.label))
    expect(screen.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true')
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toEqual([screen.getByRole('tab', { name: 'Audio' })])
  })

  it('on Home no tab is selected and the first is the tab stop', () => {
    render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: undefined,
      orientation: 'horizontal',
      onselect: () => {},
    })
    expect(tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true')).toEqual([])
    expect(tabs()[0]?.tabIndex).toBe(0)
  })

  it('a tap chooses an entry', async () => {
    const onselect = vi.fn()
    render(SuiteRail, { entries: SUITE_ENTRIES, current: undefined, orientation: 'vertical', onselect })
    await userEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(onselect).toHaveBeenCalledWith('review')
  })

  it('arrows, Home and End move along the rail and wrap; the horizontal bar uses left and right', async () => {
    const onselect = vi.fn()
    const { rerender } = render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'tuner',
      orientation: 'vertical',
      onselect,
    })
    screen.getByRole('tab', { name: 'Tuner' }).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(onselect).toHaveBeenLastCalledWith('review')
    await userEvent.keyboard('{ArrowDown}')
    expect(onselect).toHaveBeenLastCalledWith('studio')
    await userEvent.keyboard('{End}')
    expect(onselect).toHaveBeenLastCalledWith('review')
    await rerender({ orientation: 'horizontal', current: 'feel' })
    screen.getByRole('tab', { name: 'Feel' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onselect).toHaveBeenLastCalledWith('writer')
    await userEvent.keyboard('{Home}')
    expect(onselect).toHaveBeenLastCalledWith('tuner')
  })

  it('moves the focus with the choice', async () => {
    const { rerender } = render(SuiteRail, {
      entries: SUITE_ENTRIES,
      current: 'tuner',
      orientation: 'vertical',
      onselect: () => {},
    })
    screen.getByRole('tab', { name: 'Tuner' }).focus()
    await rerender({ current: 'studio' })
    expect(screen.getByRole('tab', { name: 'Studio' })).toHaveFocus()
  })

  it('Cmd or Ctrl and a digit choose that entry from anywhere; other digits and plain digits do nothing', async () => {
    const onselect = vi.fn()
    render(SuiteRail, { entries: SUITE_ENTRIES, current: undefined, orientation: 'vertical', onselect })
    await userEvent.keyboard('{Meta>}8{/Meta}')
    expect(onselect).toHaveBeenLastCalledWith('levels')
    await userEvent.keyboard('{Control>}1{/Control}')
    expect(onselect).toHaveBeenLastCalledWith('tuner')
    onselect.mockClear()
    await userEvent.keyboard('{Meta>}0{/Meta}9')
    expect(onselect).not.toHaveBeenCalled()
  })
})
