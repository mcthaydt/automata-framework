// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { EditEvent } from '#src/shared/kit/widgets/edit-event.ts'
import Segmented from '#src/shared/kit/widgets/Segmented.svelte'

const options = [
  { id: 'free', label: 'Free' },
  { id: 'grid', label: 'Grid' },
  { id: 'linear', label: 'Linear', disabled: true, reason: 'Needs two levels' },
  { id: 'tree', label: 'Tree' },
]

function mount(props: Record<string, unknown> = {}) {
  const events: EditEvent<string>[] = []
  const onedit = vi.fn((event: EditEvent<string>) => events.push(event))
  const onblocked = vi.fn()
  render(Segmented, { label: 'Layout', options, value: 'free', onedit, onblocked, ...props })
  return { events, onedit, onblocked }
}

const radio = (name: string): HTMLElement => screen.getByRole('radio', { name })

describe('Segmented', () => {
  test('is a labelled radio group with the chosen option checked', () => {
    mount()
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Grid')).toHaveAttribute('aria-checked', 'false')
  })

  test('draws a track by default and quiet tabs when asked (a top bar), with the same radio behaviour', () => {
    mount()
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toHaveAttribute('data-look', 'track')
    document.body.innerHTML = ''
    mount({ look: 'tabs' })
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toHaveAttribute('data-look', 'tabs')
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true')
  })

  test('only the checked option is in the tab order', () => {
    mount({ value: 'grid' })
    expect(radio('Grid')).toHaveAttribute('tabindex', '0')
    expect(radio('Free')).toHaveAttribute('tabindex', '-1')
    expect(radio('Tree')).toHaveAttribute('tabindex', '-1')
  })

  test('with nothing chosen the first enabled option is in the tab order', () => {
    mount({ value: '' })
    expect(radio('Free')).toHaveAttribute('tabindex', '0')
  })

  test('pressing an option emits set; pressing the chosen one emits nothing', async () => {
    const { events } = mount()
    await userEvent.click(radio('Grid'))
    await userEvent.click(radio('Grid'))
    expect(events).toEqual([{ value: 'grid', phase: 'set' }])
    expect(radio('Grid')).toHaveAttribute('aria-checked', 'true')
  })

  test('arrows choose the next enabled option and wrap, skipping the disabled one', async () => {
    const { events } = mount({ value: 'grid' })
    radio('Grid').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(radio('Tree')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}')
    expect(events.map((event) => event.value)).toEqual(['tree', 'free', 'grid', 'free', 'tree'])
  })

  test('Home and End choose the first and the last enabled option', async () => {
    const { events } = mount({ value: 'grid' })
    radio('Grid').focus()
    await userEvent.keyboard('{End}{Home}')
    expect(events.map((event) => event.value)).toEqual(['tree', 'free'])
  })

  test('a disabled option says why and is not chosen', async () => {
    const { events, onblocked } = mount()
    expect(radio('Linear')).toHaveAttribute('aria-disabled', 'true')
    expect(radio('Linear')).toHaveAccessibleDescription('Needs two levels')
    await userEvent.click(radio('Linear'))
    expect(events).toEqual([])
    expect(onblocked).toHaveBeenCalledWith('Needs two levels')
  })

  test('a disabled group blocks every option', async () => {
    const { events, onblocked } = mount({ disabled: true, reason: 'Read only' })
    await userEvent.click(radio('Grid'))
    expect(events).toEqual([])
    expect(onblocked).toHaveBeenCalledWith('Read only')
  })
})
