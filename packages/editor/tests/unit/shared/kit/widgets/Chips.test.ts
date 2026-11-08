// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import Chips from '#src/shared/kit/widgets/Chips.svelte'
import type { EditEvent } from '#src/shared/kit/widgets/edit-event.ts'

const items = [
  { id: 'tiles', label: 'Tiles' },
  { id: 'entities', label: 'Entities', removable: true },
  { id: 'collision', label: 'Collision', disabled: true, reason: 'Hidden in this template' },
]

function mount(props: Record<string, unknown> = {}) {
  const events: EditEvent<readonly string[]>[] = []
  const onedit = vi.fn((event: EditEvent<readonly string[]>) => events.push(event))
  const onremove = vi.fn()
  const onblocked = vi.fn()
  render(Chips, {
    label: 'Layers',
    items,
    selected: ['tiles'],
    mode: 'multi',
    onedit,
    onremove,
    onblocked,
    ...props,
  })
  return { events, onedit, onremove, onblocked }
}

describe('Chips', () => {
  test('is a labelled group of toggle buttons that say whether they are on', () => {
    mount()
    expect(screen.getByRole('group', { name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tiles' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Entities' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('multi mode toggles chips on and off, keeping the order of the items', async () => {
    const { events } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Entities' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tiles' }))
    expect(events).toEqual([
      { value: ['tiles', 'entities'], phase: 'set' },
      { value: ['entities'], phase: 'set' },
    ])
  })

  test('single mode keeps exactly one chip chosen', async () => {
    const { events } = mount({ mode: 'single' })
    await userEvent.click(screen.getByRole('button', { name: 'Entities' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entities' }))
    expect(events).toEqual([{ value: ['entities'], phase: 'set' }])
    expect(screen.getByRole('button', { name: 'Tiles' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('a removable chip has its own remove button, which only removes', async () => {
    const { events, onremove } = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Entities' }))
    expect(onremove).toHaveBeenCalledWith('entities')
    expect(events).toEqual([])
    expect(screen.queryByRole('button', { name: 'Remove Tiles' })).toBeNull()
  })

  test('a disabled chip says why and cannot be toggled', async () => {
    const { events, onblocked } = mount()
    const chip = screen.getByRole('button', { name: 'Collision' })
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).toHaveAccessibleDescription('Hidden in this template')
    await userEvent.click(chip)
    expect(events).toEqual([])
    expect(onblocked).toHaveBeenCalledWith('Hidden in this template')
  })
})
