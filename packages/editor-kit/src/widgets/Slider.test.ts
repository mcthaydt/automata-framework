import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { EditEvent } from './edit-event'
import Slider from './Slider.svelte'

function mount(props: Record<string, unknown> = {}) {
  const events: EditEvent<number>[] = []
  const onedit = vi.fn((event: EditEvent<number>) => events.push(event))
  const onblocked = vi.fn()
  render(Slider, { label: 'Opacity', value: 40, min: 0, max: 100, unit: '%', onedit, onblocked, ...props })
  const track = screen.getByRole('slider')
  // jsdom has no layout: give the track the box the drag maths reads.
  track.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 44,
    width: 200,
    height: 44,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  return { events, onedit, onblocked, track }
}

const send = (
  track: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  x: number,
) => fireEvent[type](track, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 20, button: 0 })

describe('Slider display and keys', () => {
  test('is a labelled slider with its range, value and readout', () => {
    const { track } = mount()
    expect(track).toHaveAttribute('aria-valuenow', '40')
    expect(track).toHaveAttribute('aria-valuemin', '0')
    expect(track).toHaveAttribute('aria-valuemax', '100')
    expect(track).toHaveAttribute('aria-valuetext', '40 %')
    expect(track).toHaveAccessibleName('Opacity')
    expect(screen.getByRole('status')).toHaveTextContent('40')
  })

  test('arrows step, Page keys move a tenth of the range, Home and End go to the ends', async () => {
    const { events, track } = mount({ value: 50 })
    track.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowUp}{ArrowLeft}{ArrowDown}{PageUp}{PageDown}{End}{Home}')
    expect(events.map((event) => event.value)).toEqual([51, 52, 51, 50, 60, 50, 100, 0])
    expect(events.every((event) => event.phase === 'set')).toBe(true)
  })

  test('uses the step, and stays inside the range', async () => {
    const { events, track } = mount({ value: 98, step: 5 })
    track.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(events.map((event) => event.value)).toEqual([100])
  })
})

describe('Slider dragging', () => {
  test('a drag follows the pointer along the track: one start, updates, one commit', async () => {
    const { events, track } = mount({ value: 0 })
    await send(track, 'pointerDown', 20)
    await send(track, 'pointerMove', 100)
    await send(track, 'pointerMove', 150)
    await send(track, 'pointerUp', 150)
    expect(events.map((event) => event.phase)).toEqual(['start', 'update', 'update', 'commit'])
    expect(events.map((event) => event.value)).toEqual([0, 50, 75, 75])
    expect(track).toHaveAttribute('aria-valuenow', '75')
  })

  test('the value snaps to the step and clamps at the ends', async () => {
    const { events, track } = mount({ value: 0, step: 5 })
    await send(track, 'pointerDown', 20)
    await send(track, 'pointerMove', 62)
    await send(track, 'pointerMove', 500)
    await send(track, 'pointerMove', -50)
    await send(track, 'pointerUp', -50)
    expect(events.map((event) => event.value)).toEqual([0, 30, 100, 0, 0])
  })

  test('a cancelled pointer cancels with the starting value', async () => {
    const { events, track } = mount()
    await send(track, 'pointerDown', 20)
    await send(track, 'pointerMove', 150)
    await send(track, 'pointerCancel', 150)
    expect(events.at(-1)).toEqual({ value: 40, phase: 'cancel' })
    expect(track).toHaveAttribute('aria-valuenow', '40')
  })

  test('a drag that ends at the starting value is a cancel', async () => {
    const { events, track } = mount({ value: 50 })
    await send(track, 'pointerDown', 100)
    await send(track, 'pointerMove', 150)
    await send(track, 'pointerMove', 100)
    await send(track, 'pointerUp', 100)
    expect(events.map((event) => event.phase)).toEqual(['start', 'update', 'update', 'cancel'])
    expect(events.at(-1)).toEqual({ value: 50, phase: 'cancel' })
  })

  test('a single tap changes nothing', async () => {
    const { events, track } = mount()
    await send(track, 'pointerDown', 150)
    await send(track, 'pointerUp', 150)
    expect(events).toEqual([])
  })
})

describe('Slider reset', () => {
  test('a double tap resets to the default value as one set', async () => {
    const { events, track } = mount({ defaultValue: 100 })
    for (let i = 0; i < 2; i++) {
      await send(track, 'pointerDown', 150)
      await send(track, 'pointerUp', 150)
    }
    expect(events).toEqual([{ value: 100, phase: 'set' }])
  })

  test('does nothing without a default, or when already at it', async () => {
    const without = mount()
    for (let i = 0; i < 2; i++) {
      await send(without.track, 'pointerDown', 150)
      await send(without.track, 'pointerUp', 150)
    }
    expect(without.events).toEqual([])
  })
})

describe('Slider disabled', () => {
  test('emits nothing, calls onblocked with the reason and describes it', async () => {
    const { events, onblocked, track } = mount({ disabled: true, reason: 'Set by the theme' })
    expect(track).toHaveAttribute('aria-disabled', 'true')
    expect(track).toHaveAccessibleDescription('Set by the theme')
    track.focus()
    await userEvent.keyboard('{ArrowRight}')
    await send(track, 'pointerDown', 20)
    await send(track, 'pointerMove', 150)
    await send(track, 'pointerUp', 150)
    expect(events).toEqual([])
    expect(onblocked).toHaveBeenCalledWith('Set by the theme')
  })
})
