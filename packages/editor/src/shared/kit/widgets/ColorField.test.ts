import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import ColorField from './ColorField.svelte'
import type { EditEvent } from './edit-event'

const palette = ['#e0a54a', '#4aa3e0', '#7be04a', '#e04a6a']

function mount(props: Record<string, unknown> = {}) {
  const events: EditEvent<string>[] = []
  const onedit = vi.fn((event: EditEvent<string>) => events.push(event))
  const onblocked = vi.fn()
  render(ColorField, { label: 'Tint', value: '#E0A54A', palette, onedit, onblocked, ...props })
  return { events, onedit, onblocked }
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Tint/ })

describe('ColorField', () => {
  test('closed, it shows the colour and its hex and is collapsed', () => {
    mount()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveAccessibleName('Tint: #e0a54a')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('pressing it opens a palette of swatches with the current colour selected', async () => {
    mount()
    await userEvent.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Tint palette' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('option', { name: '#e0a54a' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '#4aa3e0' })).toHaveAttribute('aria-selected', 'false')
  })

  test('picking a swatch emits set, closes and returns focus to the trigger', async () => {
    const { events } = mount()
    await userEvent.click(trigger())
    await userEvent.click(screen.getByRole('option', { name: '#4aa3e0' }))
    expect(events).toEqual([{ value: '#4aa3e0', phase: 'set' }])
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  test('picking the colour it already has emits nothing', async () => {
    const { events } = mount()
    await userEvent.click(trigger())
    await userEvent.click(screen.getByRole('option', { name: '#e0a54a' }))
    expect(events).toEqual([])
  })

  test('arrows move through the swatches and Enter picks', async () => {
    const { events } = mount()
    await userEvent.click(trigger())
    screen.getByRole('option', { name: '#e0a54a' }).focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    expect(events).toEqual([{ value: '#7be04a', phase: 'set' }])
  })

  test('Custom reveals a hex field that accepts #rrggbb', async () => {
    const { events } = mount()
    await userEvent.click(trigger())
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const field = screen.getByRole('textbox', { name: 'Tint custom hex' })
    expect(field).toHaveValue('#e0a54a')
    await userEvent.clear(field)
    await userEvent.type(field, '#FF00ff{Enter}')
    expect(events).toEqual([{ value: '#ff00ff', phase: 'set' }])
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  test('a bad hex is refused with a message and the panel stays open', async () => {
    const { events } = mount()
    await userEvent.click(trigger())
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const field = screen.getByRole('textbox', { name: 'Tint custom hex' })
    await userEvent.clear(field)
    await userEvent.type(field, 'red{Enter}')
    expect(events).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Use #rrggbb')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  test('Escape closes the panel and returns focus', async () => {
    mount()
    await userEvent.click(trigger())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  test('a disabled field does not open and calls onblocked', async () => {
    const { onblocked } = mount({ disabled: true, reason: 'Set by the tileset' })
    await userEvent.click(trigger())
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onblocked).toHaveBeenCalledWith('Set by the tileset')
    expect(trigger()).toHaveAccessibleDescription('Set by the tileset')
  })
})
