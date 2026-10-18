import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Prompt from './Prompt.svelte'
import type { PromptBinding, PromptCopy, PromptDevice, PromptGlyphs } from './prompt-label'

// The Prompt (M4 spec §4.6, §7): the label for the active device, following a rebind or a device switch in place,
// never remounting, and never in the focus order.

const copy: PromptCopy = {
  unbound: 'Unbound',
  touch: 'Tap',
  pad: {
    bottom: 'Bottom button',
    right: 'Right button',
    left: 'Left button',
    top: 'Top button',
    leftBumper: 'Left bumper',
    rightBumper: 'Right bumper',
    leftTrigger: 'Left trigger',
    rightTrigger: 'Right trigger',
    select: 'Select',
    start: 'Start',
    leftStick: 'Left stick',
    rightStick: 'Right stick',
    home: 'Home',
  },
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open() {
  const props = $state<{
    binding: PromptBinding
    device: PromptDevice
    glyphs: PromptGlyphs
    copy: PromptCopy
  }>({
    binding: { keys: ['Space'], pad: [0], touch: false },
    device: 'keyboard',
    glyphs: 'xbox',
    copy,
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(Prompt, { target: host, props })
  flushSync()
  const prompt = () => host.querySelector<HTMLElement>('[data-prompt]') as HTMLElement
  return { props, prompt }
}

describe('Prompt', () => {
  it('shows the active device’s label, with its kind', () => {
    const { prompt } = open()
    expect(prompt().textContent?.trim()).toBe('Space')
    expect(prompt().dataset.prompt).toBe('key')
  })

  it('follows a rebind and a device switch in place', () => {
    const { props, prompt } = open()
    const first = prompt()
    props.binding = { keys: ['KeyK'], pad: [0], touch: false }
    flushSync()
    expect(prompt().textContent?.trim()).toBe('K')
    props.device = 'gamepad'
    flushSync()
    expect(prompt().textContent?.trim()).toBe('A')
    expect(prompt().dataset.prompt).toBe('pad')
    props.device = 'touch'
    flushSync()
    expect(prompt().textContent?.trim()).toBe('Unbound')
    expect(prompt().dataset.prompt).toBe('unbound')
    expect(prompt()).toBe(first)
  })

  it('is not in the focus order', () => {
    const { prompt } = open()
    expect(prompt().tabIndex).toBe(-1)
    expect(prompt().querySelector('[tabindex], button, a[href]')).toBeNull()
  })
})
