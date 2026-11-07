// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { EditEvent } from '#src/shared/kit/widgets/edit-event.ts'
import Stepper from '#src/shared/kit/widgets/Stepper.svelte'

type Props = Record<string, unknown>

function mount(props: Props = {}) {
  const events: EditEvent<number>[] = []
  const onedit = vi.fn((event: EditEvent<number>) => events.push(event))
  const onblocked = vi.fn()
  render(Stepper, { label: 'HP', value: 3, min: 1, max: 9, onedit, onblocked, ...props })
  return { events, onedit, onblocked }
}

const spin = (): HTMLElement => screen.getByRole('spinbutton')
const label = (): HTMLElement => screen.getByText('HP', { selector: '[data-scrub-handle]' })

function pointer(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  x: number,
): Promise<boolean> {
  return fireEvent[type](label(), { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: 10, button: 0 })
}

describe('Stepper display', () => {
  test('shows the label, the value and the unit as a labelled spinbutton', () => {
    mount({ unit: 'px', value: 4 })
    expect(spin()).toHaveAttribute('aria-valuenow', '4')
    expect(spin()).toHaveAttribute('aria-valuemin', '1')
    expect(spin()).toHaveAttribute('aria-valuemax', '9')
    expect(spin()).toHaveAttribute('aria-valuetext', '4 px')
    expect(spin()).toHaveAccessibleName('HP')
    expect(spin()).toHaveTextContent('4')
    expect(spin()).toHaveTextContent('px')
  })

  test('names the buttons after the label', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Decrease HP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase HP' })).toBeInTheDocument()
  })
})

describe('Stepper buttons and keys', () => {
  test('the step buttons emit set with the new value', async () => {
    const { events } = mount({ step: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Increase HP' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decrease HP' }))
    expect(events).toEqual([
      { value: 5, phase: 'set' },
      { value: 3, phase: 'set' },
    ])
  })

  test('arrow keys step and PageUp and PageDown move ten steps', async () => {
    const { events } = mount({ min: 0, max: 100, value: 50 })
    spin().focus()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{ArrowDown}{ArrowLeft}{PageUp}{PageDown}')
    expect(events.map((event) => event.value)).toEqual([51, 52, 51, 50, 60, 50])
    expect(events.every((event) => event.phase === 'set')).toBe(true)
  })

  test('Home and End go to the bounds when there are bounds', async () => {
    const { events } = mount()
    spin().focus()
    await userEvent.keyboard('{End}{Home}')
    expect(events.map((event) => event.value)).toEqual([9, 1])
  })

  test('clamps at the bounds, emits nothing there, and shows the stop', async () => {
    const { events } = mount({ value: 9 })
    await userEvent.click(screen.getByRole('button', { name: 'Increase HP' }))
    expect(events).toEqual([])
    expect(document.querySelector('[data-widget="stepper"]')).toHaveAttribute('data-at-limit', 'max')
  })

  test('steps of 0.1 do not drift', async () => {
    const { events } = mount({ value: 0.2, step: 0.1, min: 0, max: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Increase HP' }))
    expect(events[0]?.value).toBe(0.3)
  })
})

describe('Stepper typing', () => {
  test('pressing the value opens a text field with the value selected, and Enter emits set', async () => {
    const { events } = mount()
    await userEvent.click(spin())
    const field = screen.getByRole('textbox', { name: 'HP' }) as HTMLInputElement
    expect(field).toHaveFocus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(field.value.length)
    await userEvent.keyboard('7{Enter}')
    expect(events).toEqual([{ value: 7, phase: 'set' }])
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(spin()).toHaveFocus()
  })

  test('Escape leaves the value alone', async () => {
    const { events } = mount()
    await userEvent.click(spin())
    await userEvent.keyboard('8{Escape}')
    expect(events).toEqual([])
    expect(spin()).toHaveAttribute('aria-valuenow', '3')
  })

  test('leaving the field commits what was typed', async () => {
    const { events } = mount()
    await userEvent.click(spin())
    await userEvent.keyboard('6')
    await userEvent.tab()
    expect(events).toEqual([{ value: 6, phase: 'set' }])
  })

  test('a refusal names the bound in the unit when there is one', async () => {
    mount({ unit: 'px/s' })
    await userEvent.click(spin())
    await userEvent.keyboard('12{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Must be at most 9 px/s')
  })

  test('a value above the maximum is refused with a message and the value is kept', async () => {
    const { events } = mount()
    await userEvent.click(spin())
    await userEvent.keyboard('12{Enter}')
    expect(events).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Must be at most 9')
    expect(spin()).toHaveAttribute('aria-invalid', 'true')
    expect(spin()).toHaveAttribute('aria-valuenow', '3')
    expect(document.querySelector('[data-widget="stepper"]')).toHaveAttribute('data-state', 'invalid')
  })

  test('text that is not a number is refused', async () => {
    const { events } = mount()
    await userEvent.click(spin())
    await userEvent.keyboard('abc{Enter}')
    expect(events).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number')
  })

  test('integer fields refuse a fraction', async () => {
    const { events } = mount({ integer: true })
    await userEvent.click(spin())
    await userEvent.keyboard('2.5{Enter}')
    expect(events).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Whole numbers only')
  })

  test('the editor can refuse a value with validate', async () => {
    const { events } = mount({ validate: (n: number) => (n === 5 ? 'Five is reserved' : undefined) })
    await userEvent.click(spin())
    await userEvent.keyboard('5{Enter}')
    expect(events).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Five is reserved')
  })

  test('the message goes away with the next edit', async () => {
    mount()
    await userEvent.click(spin())
    await userEvent.keyboard('99{Enter}')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase HP' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('an error from the editor shows as invalid', () => {
    mount({ error: 'Taken by another field' })
    expect(screen.getByRole('alert')).toHaveTextContent('Taken by another field')
    expect(spin()).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Stepper scrubbing', () => {
  test('dragging the label 40 px right is one start, updates, one commit and ten steps (EK-a)', async () => {
    const { events } = mount({ value: 0, min: -100, max: 100 })
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 120)
    await pointer('pointerMove', 140)
    await pointer('pointerUp', 140)
    expect(events.map((event) => event.phase)).toEqual(['start', 'update', 'update', 'commit'])
    expect(events.map((event) => event.value)).toEqual([0, 5, 10, 10])
    expect(spin()).toHaveAttribute('aria-valuenow', '10')
  })

  test('shows the scrubbing state while the pointer is down', async () => {
    mount()
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 120)
    expect(document.querySelector('[data-widget="stepper"]')).toHaveAttribute('data-state', 'scrubbing')
    await pointer('pointerUp', 120)
    expect(document.querySelector('[data-widget="stepper"]')).not.toHaveAttribute('data-state', 'scrubbing')
  })

  test('dragging past a bound clamps there', async () => {
    const { events } = mount({ value: 8 })
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 200)
    await pointer('pointerUp', 200)
    expect(events.at(-1)).toEqual({ value: 9, phase: 'commit' })
  })

  test('a cancelled pointer cancels with the value it began at', async () => {
    const { events } = mount()
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 130)
    await pointer('pointerCancel', 130)
    expect(events.map((event) => event.phase)).toEqual(['start', 'update', 'cancel'])
    expect(events.at(-1)).toEqual({ value: 3, phase: 'cancel' })
    expect(spin()).toHaveAttribute('aria-valuenow', '3')
  })

  test('a drag that ends where it began is a cancel, so it is no undo step', async () => {
    const { events } = mount()
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 120)
    await pointer('pointerMove', 100)
    await pointer('pointerUp', 100)
    expect(events.map((event) => event.phase)).toEqual(['start', 'update', 'update', 'cancel'])
    expect(events.at(-1)).toEqual({ value: 3, phase: 'cancel' })
  })

  test('pixelsPerStep sets the rate', async () => {
    const { events } = mount({ pixelsPerStep: 10, value: 5 })
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 120)
    await pointer('pointerUp', 120)
    expect(events.at(-1)).toEqual({ value: 7, phase: 'commit' })
  })
})

describe('Stepper disabled', () => {
  test('emits nothing, calls onblocked with the reason and names it in the description', async () => {
    const { events, onblocked } = mount({ disabled: true, reason: 'Locked by the template' })
    expect(spin()).toHaveAttribute('aria-disabled', 'true')
    expect(spin()).toHaveAccessibleDescription('Locked by the template')
    await userEvent.click(screen.getByRole('button', { name: 'Increase HP' }))
    spin().focus()
    await userEvent.keyboard('{ArrowUp}')
    await pointer('pointerDown', 100)
    await pointer('pointerMove', 140)
    await pointer('pointerUp', 140)
    expect(events).toEqual([])
    expect(onblocked).toHaveBeenCalledWith('Locked by the template')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
