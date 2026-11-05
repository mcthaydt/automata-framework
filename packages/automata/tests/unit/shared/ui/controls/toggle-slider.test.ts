import { fireEvent } from '@testing-library/svelte'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Slider from '#src/shared/ui/controls/Slider.svelte'
import Toggle from '#src/shared/ui/controls/Toggle.svelte'

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function host(): HTMLElement {
  const target = document.createElement('div')
  document.body.append(target)
  return target
}

describe('Toggle', () => {
  function open(checked: boolean, onchange = vi.fn()) {
    const target = host()
    component = mount(Toggle, {
      target,
      props: { label: 'Music', checked, onLabel: 'On', offLabel: 'Off', onchange },
    })
    flushSync()
    const input = target.querySelector<HTMLInputElement>('input')
    return { target, input, onchange }
  }

  it('is a checkbox with the switch role, named by its label', () => {
    const { target, input } = open(true)
    expect(input?.type).toBe('checkbox')
    expect(input?.getAttribute('role')).toBe('switch')
    expect(input?.checked).toBe(true)
    expect(target.querySelector('label')?.textContent).toContain('Music')
  })

  it('shows its state in words as well as colour', () => {
    expect(open(true).target.querySelector('[data-toggle-state]')?.textContent).toBe('On')
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    expect(open(false).target.querySelector('[data-toggle-state]')?.textContent).toBe('Off')
  })

  it('reports a click as the new state, and stays on its `checked` prop (controlled)', () => {
    const { input, onchange } = open(false)
    input?.click()
    flushSync()
    expect(onchange).toHaveBeenCalledWith(true)
    expect(input?.checked).toBe(false)
  })
})

describe('Slider', () => {
  function open(onchange = vi.fn()) {
    const target = host()
    component = mount(Slider, {
      target,
      props: {
        label: 'Music volume',
        value: 40,
        min: 0,
        max: 100,
        step: 10,
        valueText: (value: number) => `${value} percent`,
        onchange,
      },
    })
    flushSync()
    const input = target.querySelector<HTMLInputElement>('input')
    return { target, input, onchange }
  }

  it('is a labelled native range with its min, max and step', () => {
    const { target, input } = open()
    expect(input?.type).toBe('range')
    expect([input?.min, input?.max, input?.step, input?.value]).toEqual(['0', '100', '10', '40'])
    const label = target.querySelector('label')
    expect(label?.textContent).toContain('Music volume')
    expect(label?.htmlFor === input?.id || label?.contains(input ?? null)).toBe(true)
  })

  it('gives its value words through aria-valuetext', () => {
    expect(open().input?.getAttribute('aria-valuetext')).toBe('40 percent')
  })

  it('reports an input event as a number', async () => {
    const { input, onchange } = open()
    if (input === null) throw new Error('no input')
    input.value = '70'
    await fireEvent.input(input)
    expect(onchange).toHaveBeenCalledWith(70)
  })

  // The track fills with the accent up to the value, as FloorFifty's: the fill is a custom property the engines' track
  // styles read (the Desk, 2026-10-18).
  it('fills the track up to its value, as a share of its range', () => {
    expect(open().input?.style.getPropertyValue('--af-slider-fill')).toBe('40%')
  })
})
