import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PromptCopy } from '../prompts/prompt-label'
import ControlsSection from './ControlsSection.svelte'
import type {
  ControlsCopy,
  ControlsRow,
  ControlsState,
  ControlsTouchMode,
  RebindDevice,
} from './controls-section'

// The Controls section (M4 spec §4.5, §7): a row per action with a rebind button per device showing its prompt,
// pad buttons only once a pad has connected, a status line for each step of a rebind, Reset, and the touch mode
// only when the game offers both.

const promptCopy: PromptCopy = {
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
const copy: ControlsCopy = {
  title: 'Controls',
  keyboard: 'Keyboard',
  gamepad: 'Controller',
  reset: 'Reset controls',
  press: 'Press…',
  touchMode: 'Touch controls',
  touchModes: { buttons: 'Buttons', swipe: 'Swipe' },
  rebind: (action, device) => `Change ${action} on ${device}`,
  capturing: (action, device, seconds) => `Press a ${device} input for ${action} (${seconds} s)`,
  conflict: (action, other) => `${action} can't take that: ${other} would have nothing`,
  reserved: (action) => `That input is kept for menus; pick another for ${action}`,
  timedOut: (action) => `Nothing pressed; ${action} is unchanged`,
  saved: (action) => `${action} saved`,
}
const ROWS: ControlsRow[] = [
  { id: 'jump-0', label: 'Jump', binding: { keys: ['Space'], pad: [0], touch: true } },
  { id: 'fire-0', label: 'Fire', binding: { keys: [], pad: [2], touch: false } },
]

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(
  devices: RebindDevice[] = ['keyboard', 'gamepad'],
  touchModes: ControlsTouchMode[] = ['buttons'],
) {
  const onrebind = vi.fn()
  const onreset = vi.fn()
  const ontouchmode = vi.fn()
  const props = $state({
    rows: ROWS,
    devices,
    glyphs: 'xbox' as const,
    promptCopy,
    copy,
    state: { kind: 'list' } as ControlsState,
    touch: { modes: touchModes, value: 'buttons' as ControlsTouchMode, onchange: ontouchmode },
    onrebind,
    onreset,
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(ControlsSection, { target: host, props })
  flushSync()
  const section = host.querySelector<HTMLElement>('[data-settings-section="controls"]') as HTMLElement
  const button = (action: string, device: RebindDevice) =>
    section.querySelector<HTMLButtonElement>(`[data-control-row="${action}"] [data-rebind="${device}"]`)
  const message = () => section.querySelector<HTMLElement>('[data-controls-message]') as HTMLElement
  return { props, section, button, message, onrebind, onreset, ontouchmode }
}

describe('ControlsSection', () => {
  it('lists each action with a rebind button per device, each showing its prompt and named for its action', () => {
    const { section, button } = open()
    expect(
      [...section.querySelectorAll<HTMLElement>('[data-control-row]')].map((row) => row.dataset.controlRow),
    ).toEqual(['jump-0', 'fire-0'])
    expect(button('jump-0', 'keyboard')?.textContent?.trim()).toBe('Space')
    expect(button('jump-0', 'gamepad')?.textContent?.trim()).toBe('A')
    expect(button('fire-0', 'keyboard')?.textContent?.trim()).toBe('Unbound')
    expect(button('jump-0', 'keyboard')?.getAttribute('aria-label')).toBe('Change Jump on Keyboard')
    expect(section.querySelector('h3')?.textContent).toBe('Controls')
  })

  it('shows no controller buttons until a pad has connected', () => {
    const { button } = open(['keyboard'])
    expect(button('jump-0', 'keyboard')).not.toBeNull()
    expect(button('jump-0', 'gamepad')).toBeNull()
  })

  it('reports a rebind button by its action and device', () => {
    const { button, onrebind } = open()
    button('fire-0', 'gamepad')?.click()
    expect(onrebind).toHaveBeenCalledWith('fire-0', 'gamepad')
  })

  it('says each step of a rebind in a polite status line, naming actions by their labels', () => {
    const { props, message, button } = open()
    expect(message().getAttribute('role')).toBe('status')
    expect(message().textContent).toBe('')
    props.state = { kind: 'capturing', action: 'jump-0', device: 'keyboard', secondsLeft: 9 }
    flushSync()
    expect(message().textContent).toBe('Press a Keyboard input for Jump (9 s)')
    expect(button('jump-0', 'keyboard')?.textContent?.trim()).toBe('Press…')
    expect(button('jump-0', 'keyboard')?.dataset.capturing).toBe('')
    props.state = { kind: 'conflict', action: 'jump-0', with: 'fire-0' }
    flushSync()
    expect(message().textContent).toBe("Jump can't take that: Fire would have nothing")
    for (const [state, words] of [
      [{ kind: 'reserved', action: 'jump-0' }, 'That input is kept for menus; pick another for Jump'],
      [{ kind: 'timed-out', action: 'jump-0' }, 'Nothing pressed; Jump is unchanged'],
      [{ kind: 'saved', action: 'jump-0' }, 'Jump saved'],
    ] as const) {
      props.state = state
      flushSync()
      expect(message().textContent).toBe(words)
    }
    expect((message().closest('[data-settings-section]') as HTMLElement).dataset.state).toBe('saved')
  })

  it('resets every binding', () => {
    const { section, onreset } = open()
    section.querySelector<HTMLButtonElement>('[data-testid="controls-reset"]')?.click()
    expect(onreset).toHaveBeenCalledOnce()
  })

  it('offers the touch mode only when the game has both', () => {
    expect(open().section.querySelector('[data-controls-touch-mode]')).toBeNull()
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    const { section, ontouchmode } = open(['keyboard'], ['buttons', 'swipe'])
    const swipe = section.querySelector<HTMLInputElement>('[data-controls-touch-mode] input[value="swipe"]')
    swipe?.click()
    expect(ontouchmode).toHaveBeenCalledWith('swipe')
  })
})
