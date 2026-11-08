// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import Picker from '#src/shared/kit/widgets/Picker.svelte'
import type { PickerOption } from '#src/shared/kit/widgets/picker-model.ts'

const options: readonly PickerOption[] = [
  { id: 'grass', label: 'Grass', group: 'Ground' },
  { id: 'sand', label: 'Sand', detail: 'Dry', group: 'Ground' },
  {
    id: 'water',
    label: 'Water',
    group: 'Liquid',
    disabled: true,
    reason: 'Needs a tileset with water tiles',
  },
  { id: 'lava', label: 'Lava', group: 'Liquid' },
  { id: 'none', label: 'None' },
]

const many: readonly PickerOption[] = Array.from({ length: 9 }, (_, i) => ({
  id: `t${i}`,
  label: `Tile ${i}`,
}))

function mount(props: Record<string, unknown> = {}) {
  const onpick = vi.fn()
  const onblocked = vi.fn()
  render(Picker, { label: 'Terrain', options, placeholder: 'Choose terrain', onpick, onblocked, ...props })
  return { onpick, onblocked }
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: /Terrain/ })
const option = (name: string): HTMLElement => screen.getByRole('option', { name: (n) => n.startsWith(name) })

async function open(props: Record<string, unknown> = {}) {
  const mounted = mount(props)
  await userEvent.click(trigger())
  return mounted
}

describe('Picker trigger', () => {
  test('shows the placeholder, then the chosen option, and says it opens a listbox', () => {
    mount()
    expect(trigger()).toHaveTextContent('Choose terrain')
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  test('shows the selected option', () => {
    mount({ value: 'sand' })
    expect(trigger()).toHaveTextContent('Sand')
    expect(trigger()).toHaveAccessibleName('Terrain: Sand')
  })

  test.each([['{Enter}'], [' '], ['{ArrowDown}'], ['{ArrowUp}']])('%j opens it', async (key) => {
    mount()
    trigger().focus()
    await userEvent.keyboard(key)
    expect(screen.getByRole('listbox', { name: 'Terrain' })).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  })

  test('a disabled picker says why and does not open', async () => {
    const { onblocked } = mount({ disabled: true, reason: 'Pick a layer first' })
    expect(trigger()).toHaveAttribute('aria-disabled', 'true')
    expect(trigger()).toHaveAccessibleDescription('Pick a layer first')
    await userEvent.click(trigger())
    expect(onblocked).toHaveBeenCalledWith('Pick a layer first')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('Picker list', () => {
  test('shows the options under their group headings, the chosen one selected', async () => {
    await open({ value: 'lava' })
    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(option('Lava')).toHaveAttribute('aria-selected', 'true')
    expect(option('Grass')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('group', { name: 'Ground' })).toContainElement(option('Grass'))
    expect(screen.getByRole('group', { name: 'Liquid' })).toContainElement(option('Lava'))
  })

  test('draws an option detail beside its label', async () => {
    await open()
    expect(option('Sand')).toHaveTextContent('Dry')
  })

  test('a list of eight or fewer has no search field, unless asked for', async () => {
    await open()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  test('searchable forces the field on a short list, and a long list has one without being asked', async () => {
    await open({ searchable: true })
    expect(screen.getByRole('searchbox', { name: 'Search Terrain' })).toBeInTheDocument()
  })

  test('nine options bring the search field', async () => {
    await open({ options: many })
    expect(screen.getByRole('searchbox', { name: 'Search Terrain' })).toBeInTheDocument()
  })

  test('searchable: false keeps it off a long list', async () => {
    await open({ options: many, searchable: false })
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  test('focus starts in the search field when there is one, else on the list', async () => {
    await open({ searchable: true })
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  test('without a field the list itself takes focus', async () => {
    await open()
    expect(screen.getByRole('listbox')).toHaveFocus()
  })

  test('the active option is the chosen one, else the first enabled one', async () => {
    await open({ value: 'lava' })
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', option('Lava').id)
  })

  test('the first enabled option is active when nothing is chosen', async () => {
    await open()
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', option('Grass').id)
  })

  test('arrows move the active option, skipping the disabled one, and wrap', async () => {
    await open()
    const list = screen.getByRole('listbox')
    await userEvent.keyboard('{ArrowDown}')
    expect(list).toHaveAttribute('aria-activedescendant', option('Sand').id)
    await userEvent.keyboard('{ArrowDown}')
    expect(list).toHaveAttribute('aria-activedescendant', option('Lava').id)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(list).toHaveAttribute('aria-activedescendant', option('Grass').id)
    await userEvent.keyboard('{ArrowUp}')
    expect(list).toHaveAttribute('aria-activedescendant', option('None').id)
  })

  test('Home and End go to the first and last enabled options', async () => {
    await open()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', option('None').id)
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', option('Grass').id)
  })

  test('a disabled option says why', async () => {
    await open()
    expect(option('Water')).toHaveAttribute('aria-disabled', 'true')
    expect(option('Water')).toHaveAccessibleDescription('Needs a tileset with water tiles')
  })
})

describe('Picker choosing', () => {
  test('Enter picks the active option, closes, shows it and gives focus back', async () => {
    const { onpick } = await open()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onpick).toHaveBeenCalledWith('sand')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger()).toHaveTextContent('Sand')
    expect(trigger()).toHaveFocus()
  })

  test('pressing an option picks it', async () => {
    const { onpick } = await open()
    await userEvent.click(option('Lava'))
    expect(onpick).toHaveBeenCalledWith('lava')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('pressing a disabled option says why and keeps the list open', async () => {
    const { onpick, onblocked } = await open()
    await userEvent.click(option('Water'))
    expect(onblocked).toHaveBeenCalledWith('Needs a tileset with water tiles')
    expect(onpick).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  test('pressing an option does not take focus from the list or the search field', async () => {
    await open()
    await userEvent.click(option('Water'))
    expect(screen.getByRole('listbox')).toHaveFocus()
  })

  test('Escape closes without picking', async () => {
    const { onpick } = await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onpick).not.toHaveBeenCalled()
    expect(trigger()).toHaveFocus()
  })
})

describe('Picker search', () => {
  test('typing filters by label and by detail, keeping the headings that still have options', async () => {
    await open({ searchable: true })
    await userEvent.keyboard('dry')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(option('Sand')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Liquid' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Ground' })).toBeInTheDocument()
  })

  test('the first match becomes active, and Enter picks it', async () => {
    const { onpick } = await open({ searchable: true })
    await userEvent.keyboard('LA')
    await userEvent.keyboard('{Enter}')
    expect(onpick).toHaveBeenCalledWith('lava')
  })

  test('arrows work from inside the field', async () => {
    await open({ searchable: true })
    await userEvent.keyboard('a{ArrowDown}')
    // "a" matches Grass, Sand, Water (disabled), Lava: Grass is active first, then Sand.
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-activedescendant', option('Sand').id)
  })

  test('nothing left: an empty state, and Enter picks nothing', async () => {
    const { onpick } = await open({ searchable: true })
    await userEvent.keyboard('zzz')
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByText('No matches for “zzz”')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(onpick).not.toHaveBeenCalled()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  test('clearing the search brings the whole list back', async () => {
    await open({ searchable: true })
    await userEvent.keyboard('lava')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await userEvent.clear(screen.getByRole('searchbox'))
    expect(screen.getAllByRole('option')).toHaveLength(5)
  })

  test('opens again with an empty search', async () => {
    await open({ searchable: true })
    await userEvent.keyboard('lava{Escape}')
    await userEvent.click(trigger())
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getAllByRole('option')).toHaveLength(5)
  })
})

describe('Picker as a sheet', () => {
  test('shows the same list in a bottom sheet, and the scrim closes it', async () => {
    const { onpick } = mount({ presentation: 'sheet', searchable: true })
    await userEvent.click(trigger())
    const root = document.querySelector('[data-popup-root]') as HTMLElement
    expect(root).toHaveAttribute('data-presentation', 'sheet')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    await userEvent.click(root)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onpick).not.toHaveBeenCalled()
  })

  test('picking in the sheet works as in the popover', async () => {
    const { onpick } = mount({ presentation: 'sheet' })
    await userEvent.click(trigger())
    await userEvent.click(option('None'))
    expect(onpick).toHaveBeenCalledWith('none')
    expect(trigger()).toHaveTextContent('None')
  })
})
