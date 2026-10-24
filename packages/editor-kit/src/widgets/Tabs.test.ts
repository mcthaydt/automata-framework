import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import TabsFixture from '../testing/TabsFixture.svelte'

const tabs = [
  { id: 'entity', label: 'Entity' },
  { id: 'level', label: 'Level' },
  { id: 'checks', label: 'Checks', disabled: true, reason: 'Nothing to check yet' },
  { id: 'notes', label: 'Notes' },
]

function mount(value = 'entity') {
  const onselect = vi.fn()
  const onblocked = vi.fn()
  render(TabsFixture, { tabs, value, onselect, onblocked })
  return { onselect, onblocked }
}

const tab = (name: string): HTMLElement => screen.getByRole('tab', { name })

describe('Tabs', () => {
  test('is a labelled tablist with the chosen tab selected and its panel shown', () => {
    mount('level')
    expect(screen.getByRole('tablist', { name: 'Inspector' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(tab('Level')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Entity')).toHaveAttribute('aria-selected', 'false')
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAccessibleName('Level')
    expect(panel).toHaveTextContent('Panel level')
    expect(tab('Level')).toHaveAttribute('aria-controls', panel.id)
  })

  test('only the selected tab is in the tab order', () => {
    mount()
    expect(tab('Entity')).toHaveAttribute('tabindex', '0')
    expect(tab('Level')).toHaveAttribute('tabindex', '-1')
  })

  test('pressing a tab selects it and swaps the panel', async () => {
    const { onselect } = mount()
    await userEvent.click(tab('Notes'))
    expect(onselect).toHaveBeenCalledWith('notes')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel notes')
    expect(screen.queryByText('Panel entity')).toBeNull()
  })

  test('arrows select and focus the next enabled tab and wrap, skipping the disabled one', async () => {
    const { onselect } = mount('level')
    tab('Level').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(tab('Notes')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}')
    expect(onselect.mock.calls.map((call) => call[0])).toEqual(['notes', 'entity', 'notes', 'level'])
  })

  test('Home and End select the first and the last enabled tab', async () => {
    const { onselect } = mount('level')
    tab('Level').focus()
    await userEvent.keyboard('{End}{Home}')
    expect(onselect.mock.calls.map((call) => call[0])).toEqual(['notes', 'entity'])
  })

  test('a disabled tab says why and is not selected', async () => {
    const { onselect, onblocked } = mount()
    expect(tab('Checks')).toHaveAttribute('aria-disabled', 'true')
    expect(tab('Checks')).toHaveAccessibleDescription('Nothing to check yet')
    await userEvent.click(tab('Checks'))
    expect(onselect).not.toHaveBeenCalled()
    expect(onblocked).toHaveBeenCalledWith('Nothing to check yet')
    expect(tab('Entity')).toHaveAttribute('aria-selected', 'true')
  })
})
