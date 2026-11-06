import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, test, vi } from 'vitest'
import MenuInDialogFixture from '../../../testing/kit/MenuInDialogFixture.svelte'
import Menu from './Menu.svelte'

const items = [
  { id: 'rename', label: 'Rename' },
  { id: 'duplicate', label: 'Duplicate', disabled: true, reason: 'Layers of this kind cannot be copied' },
  'separator',
  { id: 'delete', label: 'Delete', detail: '⌫' },
  { id: 'export', label: 'Export…' },
] as const

function mount(props: Record<string, unknown> = {}) {
  const onselect = vi.fn()
  const onblocked = vi.fn()
  render(Menu, { label: 'Layer', items, onselect, onblocked, ...props })
  return { onselect, onblocked }
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Layer' })
// The accessible name of a row with a shortcut hint is the label and the hint, so match on how it starts.
const item = (name: string): HTMLElement =>
  screen.getByRole('menuitem', { name: (accessible) => accessible.startsWith(name) })

describe('Menu trigger', () => {
  test('is a menu button that says whether the menu is open', async () => {
    mount()
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
    await userEvent.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Layer' })).toBeInTheDocument()
  })

  test.each([['{Enter}'], [' '], ['{ArrowDown}']])(
    '%j opens it with the first enabled item focused',
    async (key) => {
      mount()
      trigger().focus()
      await userEvent.keyboard(key)
      expect(item('Rename')).toHaveFocus()
    },
  )

  test('ArrowUp opens it with the last enabled item focused', async () => {
    mount()
    trigger().focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(item('Export…')).toHaveFocus()
  })

  test('pressing the trigger again closes it', async () => {
    mount()
    await userEvent.click(trigger())
    await userEvent.click(trigger())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('a disabled menu says why and does not open', async () => {
    const { onblocked } = mount({ disabled: true, reason: 'Nothing to act on' })
    expect(trigger()).toHaveAttribute('aria-disabled', 'true')
    expect(trigger()).toHaveAccessibleDescription('Nothing to act on')
    await userEvent.click(trigger())
    expect(onblocked).toHaveBeenCalledWith('Nothing to act on')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('a trigger drawn as an icon is still named by the label', () => {
    const trigger = createRawSnippet(() => ({ render: () => '<span aria-hidden="true">⋯</span>' }))
    mount({ trigger })
    expect(screen.getByRole('button', { name: 'Layer' })).toHaveTextContent('⋯')
  })
})

describe('Menu items', () => {
  async function open() {
    const mounted = mount()
    trigger().focus()
    await userEvent.keyboard('{Enter}')
    return mounted
  }

  test('lists the items with their shortcut hints and a separator', async () => {
    await open()
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Rename',
      'Duplicate',
      'Delete ⌫',
      'Export…',
    ])
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  test('arrows move through the enabled items and wrap, skipping the disabled one and the separator', async () => {
    await open()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Delete')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(item('Rename')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(item('Export…')).toHaveFocus()
  })

  test('Home and End go to the first and last enabled items', async () => {
    await open()
    await userEvent.keyboard('{End}')
    expect(item('Export…')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(item('Rename')).toHaveFocus()
  })

  test('typing letters jumps to the next item that starts with them', async () => {
    await open()
    await userEvent.keyboard('e')
    expect(item('Export…')).toHaveFocus()
    // Moving by key starts a new word, so this is a fresh "d", not "ed".
    await userEvent.keyboard('{Home}d')
    expect(item('Delete')).toHaveFocus()
  })

  test('a disabled item is announced as disabled with its reason', async () => {
    await open()
    expect(item('Duplicate')).toHaveAttribute('aria-disabled', 'true')
    expect(item('Duplicate')).toHaveAccessibleDescription('Layers of this kind cannot be copied')
  })

  test('only the focused item is in the tab order', async () => {
    await open()
    expect(item('Rename')).toHaveAttribute('tabindex', '0')
    expect(item('Delete')).toHaveAttribute('tabindex', '-1')
  })

  test('Enter selects, closes the menu and gives focus back to the trigger', async () => {
    const { onselect } = await open()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onselect).toHaveBeenCalledWith('delete')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  test('pressing an item selects it', async () => {
    const { onselect } = await open()
    await userEvent.click(item('Export…'))
    expect(onselect).toHaveBeenCalledWith('export')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('pressing a disabled item says why and keeps the menu open', async () => {
    const { onselect, onblocked } = await open()
    await userEvent.click(item('Duplicate'))
    expect(onblocked).toHaveBeenCalledWith('Layers of this kind cannot be copied')
    expect(onselect).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  test('Escape closes it and gives focus back to the trigger', async () => {
    const { onselect } = await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger()).toHaveFocus()
    expect(onselect).not.toHaveBeenCalled()
  })

  test('a press outside closes it', async () => {
    await open()
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('a press on something else closes it, reaches that thing, and leaves focus there', async () => {
    await open()
    const other = document.createElement('button')
    const pressed = vi.fn()
    other.addEventListener('click', pressed)
    document.body.append(other)
    await userEvent.click(other)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(pressed).toHaveBeenCalledTimes(1)
    expect(other).toHaveFocus()
    other.remove()
  })

  test('Tab closes it and leaves focus on the trigger', async () => {
    await open()
    await userEvent.tab()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger()).toHaveFocus()
  })
})

describe('Menu as a sheet', () => {
  test('shows the same items in a bottom sheet with a scrim, and the scrim closes it', async () => {
    const { onselect } = mount({ presentation: 'sheet' })
    await userEvent.click(trigger())
    const root = document.querySelector('[data-popup-root]') as HTMLElement
    expect(root).toHaveAttribute('data-presentation', 'sheet')
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    await userEvent.click(root)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onselect).not.toHaveBeenCalled()
  })

  test('choosing an item in the sheet works as in the popover', async () => {
    const { onselect } = mount({ presentation: 'sheet' })
    await userEvent.click(trigger())
    await userEvent.click(item('Rename'))
    expect(onselect).toHaveBeenCalledWith('rename')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Menu inside a dialog', () => {
  test('opens within the dialog, and Escape closes the menu first and the dialog second', async () => {
    const onclose = vi.fn()
    render(MenuInDialogFixture, { onclose })
    const more = screen.getByRole('button', { name: 'More' })
    await userEvent.click(more)
    expect(screen.getByRole('menu').closest('[data-dialog-root]')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onclose).not.toHaveBeenCalled()
    expect(more).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledWith('escape')
  })

  test('choosing an item leaves the dialog open', async () => {
    const onselect = vi.fn()
    render(MenuInDialogFixture, { onselect })
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Second' }))
    expect(onselect).toHaveBeenCalledWith('b')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
