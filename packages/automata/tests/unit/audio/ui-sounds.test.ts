import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installUiSounds, requestUiSound, type UiSounds } from '#src/features/audio/ui-sounds.ts'

// Interface sounds: one listener at the root of the overlay makes every control sound without wiring. The clock is
// injected, so the timings (the focus tick's spacing and its quiet after a press or a scroll) are exact.

type Played = Array<{ alias: string; options: unknown }>

let root: HTMLElement
let clock = 0
let played: Played
let removers: Array<() => void> = []

beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
  clock = 1000
  played = []
})
afterEach(() => {
  for (const remove of removers) remove()
  removers = []
  root.remove()
})

const audio = { sound: (alias: string, options?: unknown) => void played.push({ alias, options }) }

const MAP: UiSounds = {
  press: 'press.wav',
  back: 'back.wav',
  focus: 'focus.wav',
  error: 'error.wav',
  open: 'open.wav',
  close: 'close.wav',
  coin: { alias: 'coin.wav', gain: 0.8 },
}

function install(sounds: UiSounds = MAP) {
  const remove = installUiSounds(root, audio, sounds, () => clock)
  removers.push(remove)
  return remove
}

function control(html: string): HTMLElement {
  root.insertAdjacentHTML('beforeend', html)
  const made = root.lastElementChild
  if (!(made instanceof HTMLElement)) throw new Error('no element')
  return made
}

/** A pointer press with `pointerType`: jsdom's own PointerEvent where it has one. */
function pointerDown(target: Element, pointerType = 'mouse'): void {
  const event = new MouseEvent('pointerdown', { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  target.dispatchEvent(event)
}

const names = () => played.map((entry) => entry.alias)

describe('a press', () => {
  it('plays press on the ui bus for a button with no attribute', () => {
    install()
    control('<button>Play</button>').click()
    expect(played).toEqual([{ alias: 'press.wav', options: { bus: 'ui' } }])
  })

  it('plays back for data-sfx="back"', () => {
    install()
    control('<button data-sfx="back">Back</button>').click()
    expect(names()).toEqual(['back.wav'])
  })

  it('plays nothing for data-sfx="none"', () => {
    install()
    control('<button data-sfx="none">Mute</button>').click()
    expect(played).toEqual([])
  })

  it('plays nothing for a disabled button', () => {
    install()
    control('<button disabled>Locked</button>').click()
    expect(played).toEqual([])
  })

  it('plays the game’s own sound for a name of its own, with its gain', () => {
    install()
    control('<button data-sfx="coin">Buy</button>').click()
    expect(played).toEqual([{ alias: 'coin.wav', options: { bus: 'ui', gain: 0.8 } }])
  })

  it('plays nothing for a name the map lacks', () => {
    install()
    control('<button data-sfx="unheard">Odd</button>').click()
    expect(played).toEqual([])
  })

  it('is silent for a game that maps nothing', () => {
    install({})
    control('<button>Play</button>').click()
    expect(played).toEqual([])
  })

  it('sounds a link, a role="button", a checkbox and a select, and not a range or a text box', () => {
    install()
    for (const html of [
      '<a href="#x">Link</a>',
      '<div role="button" tabindex="0">Pseudo</div>',
      '<input type="checkbox" />',
      '<select><option>a</option></select>',
    ])
      control(html).click()
    expect(names()).toHaveLength(4)
    played = []
    control('<input type="range" />').click()
    control('<input type="text" />').click()
    expect(played).toEqual([])
  })

  it('sounds once for a label that wraps its checkbox', () => {
    install()
    const label = control('<label><span>Mute</span><input type="checkbox" /></label>')
    label.querySelector('span')?.click()
    expect(names()).toEqual(['press.wav'])
  })

  it('takes data-sfx from the nearest element above the control', () => {
    install()
    const wrapper = control('<div data-sfx="back"><button>Close</button></div>')
    wrapper.querySelector('button')?.click()
    expect(names()).toEqual(['back.wav'])
  })

  it('calls a function map with the name', () => {
    const heard: string[] = []
    install((name) => void heard.push(name))
    control('<button data-sfx="back">Back</button>').click()
    control('<button data-sfx="none">Mute</button>').click()
    control('<button>Play</button>').click()
    expect(heard).toEqual(['back', 'press'])
  })
})

describe('moving focus', () => {
  it('ticks at half gain for the keyboard', () => {
    install()
    const button = control('<button>One</button>')
    button.focus()
    expect(played).toEqual([{ alias: 'focus.wav', options: { bus: 'ui', gain: 0.5 } }])
  })

  it('uses the entry’s own gain for focus when it has one', () => {
    install({ focus: { alias: 'tick.wav', gain: 0.2 } })
    control('<button>One</button>').focus()
    expect(played).toEqual([{ alias: 'tick.wav', options: { bus: 'ui', gain: 0.2 } }])
  })

  it('a held arrow key: ten focus moves in 300 ms make at most four ticks', () => {
    install()
    const buttons = Array.from({ length: 10 }, (_, index) => control(`<button>${index}</button>`))
    for (const button of buttons) {
      button.focus()
      clock += 30
    }
    expect(names().length).toBeGreaterThan(0)
    expect(names().length).toBeLessThanOrEqual(4)
  })

  it('does not tick within 400 ms of a pointer press, and does again after', () => {
    install()
    const one = control('<button>One</button>')
    const two = control('<button>Two</button>')
    pointerDown(one)
    one.focus()
    clock += 399
    two.focus()
    expect(played).toEqual([])
    clock += 2
    one.focus()
    expect(names()).toEqual(['focus.wav'])
  })

  it('never ticks for a touch pointer', () => {
    install()
    const one = control('<button>One</button>')
    pointerDown(one, 'touch')
    clock += 5000
    one.focus()
    expect(played).toEqual([])
  })

  it('ticks again for the keyboard after a touch', () => {
    install()
    const one = control('<button>One</button>')
    const two = control('<button>Two</button>')
    pointerDown(one, 'touch')
    clock += 5000
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    two.focus()
    expect(names()).toEqual(['focus.wav'])
  })

  it('is quiet for 250 ms after a scroll or a wheel', () => {
    install()
    const one = control('<button>One</button>')
    const two = control('<button>Two</button>')
    root.dispatchEvent(new Event('wheel', { bubbles: true }))
    clock += 249
    one.focus()
    expect(played).toEqual([])
    root.dispatchEvent(new Event('scroll'))
    clock += 249
    two.focus()
    expect(played).toEqual([])
    clock += 2
    one.focus()
    expect(names()).toEqual(['focus.wav'])
  })

  it('does not tick again when focus returns to the control that last had it', () => {
    install()
    const one = control('<button>One</button>')
    one.focus()
    one.blur()
    clock += 1000
    one.focus()
    expect(names()).toEqual(['focus.wav'])
  })

  it('does not tick for something that is not a control', () => {
    install()
    control('<div tabindex="0">Panel</div>').focus()
    expect(played).toEqual([])
  })

  it('does not tick on top of a press: the click’s own focus change stays quiet', () => {
    install()
    const one = control('<button>One</button>')
    pointerDown(one)
    one.focus()
    one.click()
    expect(names()).toEqual(['press.wav'])
  })
})

describe('requestUiSound', () => {
  it('plays the named sound from a component with no press behind it', () => {
    install()
    requestUiSound(control('<span>Oops</span>'), 'error')
    expect(names()).toEqual(['error.wav'])
  })

  it('open and close start the 400 ms quiet, so the focus they move stays silent', () => {
    install()
    const one = control('<button>One</button>')
    requestUiSound(one, 'open')
    clock += 399
    one.focus()
    expect(names()).toEqual(['open.wav'])
  })

  it('plays nothing for a name the map lacks', () => {
    install({})
    requestUiSound(control('<span>x</span>'), 'error')
    expect(played).toEqual([])
  })
})

describe('the returned remover', () => {
  it('takes every listener away', () => {
    const remove = install()
    const one = control('<button>One</button>')
    remove()
    one.click()
    one.focus()
    requestUiSound(one, 'error')
    root.dispatchEvent(new Event('wheel'))
    expect(played).toEqual([])
  })
})
