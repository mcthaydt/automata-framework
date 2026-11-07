import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ControlsSection from '#src/app/screens/settings/ControlsSection.svelte'
import type {
  ControlsCopy,
  ControlsRow,
  ControlsState,
  RebindDevice,
} from '#src/app/screens/settings/controls-section.ts'
import type { PromptCopy, PromptDevice } from '#src/shared/ui/prompts/prompt-label.ts'

// The Controls tab's section (M4 spec §4.5, §7), laid out as FloorFifty's Controls tab (`SettingsPanel.svelte` at
// a28dc44): one section per device the player can use, the one in use first and marked; Keyboard and Controller list
// each action with its rebind button showing its prompt, the Controller only once a pad has connected; Touch says
// what the on-screen buttons do. A status line says each step of a rebind, and Reset ends the tab.

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
  touch: 'Touch',
  inUse: 'In use',
  reset: 'Reset controls',
  press: 'Press…',
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
  { inUse = 'keyboard', touch = false }: { inUse?: PromptDevice; touch?: boolean } = {},
) {
  const onrebind = vi.fn()
  const onreset = vi.fn()
  const props = $state({
    rows: ROWS,
    devices,
    touch,
    inUse,
    glyphs: 'xbox' as const,
    promptCopy,
    copy,
    state: { kind: 'list' } as ControlsState,
    onrebind,
    onreset,
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(ControlsSection, { target: host, props })
  flushSync()
  const section = host.querySelector<HTMLElement>('[data-settings-section="controls"]') as HTMLElement
  const button = (action: string, device: RebindDevice) =>
    section.querySelector<HTMLButtonElement>(
      `[data-controls-device="${device}"] [data-control-row="${action}"] [data-rebind="${device}"]`,
    )
  const message = () => section.querySelector<HTMLElement>('[data-controls-message]') as HTMLElement
  /** The device sections in order, each with its heading and whether it is marked in use. */
  const devicesShown = () =>
    [...section.querySelectorAll<HTMLElement>('[data-controls-device]')].map((one) => [
      one.dataset.controlsDevice,
      one.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim(),
    ])
  return { props, section, button, message, devicesShown, onrebind, onreset }
}

describe('ControlsSection', () => {
  it('has a section per device, the one in use first and marked', () => {
    expect(open().devicesShown()).toEqual([
      ['keyboard', 'Keyboard In use'],
      ['gamepad', 'Controller'],
    ])
    unmount(component as ReturnType<typeof mount>)
    const { devicesShown, props } = open(['keyboard', 'gamepad'], { inUse: 'gamepad', touch: true })
    expect(devicesShown()).toEqual([
      ['gamepad', 'Controller In use'],
      ['keyboard', 'Keyboard'],
      ['touch', 'Touch'],
    ])
    props.inUse = 'touch'
    flushSync()
    expect(devicesShown().map(([device]) => device)).toEqual(['touch', 'keyboard', 'gamepad'])
  })

  it('lists each action in a device’s section with one rebind button, showing its prompt, named for its action', () => {
    const { section, button } = open()
    const rows = (device: string) =>
      [...section.querySelectorAll<HTMLElement>(`[data-controls-device="${device}"] [data-control-row]`)].map(
        (row) => [row.dataset.controlRow, row.querySelectorAll('button').length],
      )
    expect(rows('keyboard')).toEqual([
      ['jump-0', 1],
      ['fire-0', 1],
    ])
    expect(rows('gamepad')).toEqual(rows('keyboard'))
    expect(button('jump-0', 'keyboard')?.textContent?.trim()).toBe('Space')
    expect(button('jump-0', 'gamepad')?.textContent?.trim()).toBe('A')
    expect(button('fire-0', 'keyboard')?.textContent?.trim()).toBe('Unbound')
    expect(button('jump-0', 'keyboard')?.getAttribute('aria-label')).toBe('Change Jump on Keyboard')
    expect(section.getAttribute('aria-label')).toBe('Controls')
  })

  it('shows no controller section until a pad has connected', () => {
    const { section, button } = open(['keyboard'])
    expect(button('jump-0', 'keyboard')).not.toBeNull()
    expect(section.querySelector('[data-controls-device="gamepad"]')).toBeNull()
  })

  it('says what the on-screen buttons do in the touch section, with nothing to rebind', () => {
    const { section } = open(['keyboard'], { touch: true })
    const touch = section.querySelector<HTMLElement>('[data-controls-device="touch"]') as HTMLElement
    expect(
      [...touch.querySelectorAll<HTMLElement>('[data-control-row]')].map((row) =>
        row.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['Jump Tap'])
    expect(touch.querySelector('button')).toBeNull()
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

  it('ends with Reset, after every device', () => {
    const { section, onreset } = open(['keyboard', 'gamepad'], { touch: true })
    const reset = section.querySelector<HTMLButtonElement>(
      '[data-testid="controls-reset"]',
    ) as HTMLButtonElement
    const last = [...section.querySelectorAll('[data-controls-device]')].at(-1) as Element
    expect(last.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    reset.click()
    expect(onreset).toHaveBeenCalledOnce()
  })
})
