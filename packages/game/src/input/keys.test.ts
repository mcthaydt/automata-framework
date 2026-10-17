import { defineCommand } from '@mcthaydt/automata-sim'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { keys } from './keys.ts'

// keys(): what is held → one command per tick (DX spec §3.3). Extracted from Emberwick's input
// (games/emberwick/src/input/keys.ts and devices.ts): keys by `KeyboardEvent.code`, touch buttons that hold,
// everything released on blur.
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step, jump: z.boolean().default(false) }))
const Strict = defineCommand('strict', z.object({ x: z.number(), jump: z.boolean() }))

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
const lift = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))
const payloadAt = (source: { commands(tick: number): readonly { payload: unknown }[] }, tick = 0) =>
  source.commands(tick).map((command) => command.payload)

const arrows = keys(Move, {
  ArrowLeft: { x: -1 },
  KeyA: { x: -1 },
  ArrowRight: { x: 1 },
  Space: { jump: true },
})

describe('keys() construction', () => {
  it('throws on a binding the command schema refuses, naming the key', () => {
    expect(() => keys(Move, { KeyQ: { x: 5 } })).toThrow(/KeyQ.*move/)
  })

  it('throws when a binding leaves required fields unset and there is no idle payload', () => {
    expect(() => keys(Strict, { ArrowLeft: { x: -1 } })).toThrow(/ArrowLeft/)
  })

  it('takes an idle payload for a schema without defaults', () => {
    expect(() => keys(Strict, { ArrowLeft: { x: -1 } }, { idle: { x: 0, jump: false } })).not.toThrow()
  })

  it('makes one touch button per distinct payload, keys in binding order', () => {
    expect(arrows.touchButtons).toEqual([
      { id: 'move-0', label: '←', keys: ['ArrowLeft', 'KeyA'] },
      { id: 'move-1', label: '→', keys: ['ArrowRight'] },
      { id: 'move-2', label: 'Space', keys: ['Space'] },
    ])
    expect(arrows.touch).toBe(true)
    expect(keys(Move, {}, { touch: false }).touch).toBe(false)
  })
})

describe('keys() profile and toCommand (M4 spec §2.2)', () => {
  const padded = keys(
    Move,
    { ArrowLeft: { x: -1 }, KeyA: { x: -1 }, Space: { jump: true } },
    {
      pad: { 14: { x: -1 }, 0: { jump: true }, 12: { y: -1 } },
    },
  )

  it('makes one action per distinct payload: its keys, its pad buttons and a touch button', () => {
    expect(padded.profile).toEqual({
      id: 'move',
      bindings: {
        'move-0': { keys: ['ArrowLeft', 'KeyA'], pad: [14], touch: true },
        'move-1': { keys: ['Space'], pad: [0], touch: true },
        'move-2': { keys: [], pad: [12], touch: false },
      },
    })
    expect(padded.touchButtons.map((button) => button.id)).toEqual(['move-0', 'move-1'])
  })

  it('binds no touch button when touch is off', () => {
    expect(keys(Move, { Space: { jump: true } }, { touch: false }).profile.bindings['move-0']?.touch).toBe(
      false,
    )
  })

  it('refuses a reserved key, as the profile schema does (I-j)', () => {
    expect(() => keys(Move, { Escape: { jump: true } })).toThrow(/Escape/)
    expect(() => keys(Move, {}, { pad: { 8: { jump: true } } })).toThrow(/pad button 8/)
  })

  it('is pure: the held actions make this tick’s one command', () => {
    expect(padded.toCommand(new Set(['move-1']), 3)).toEqual([
      { tick: 3, source: 0, seq: 3, type: 'move', payload: { x: 0, y: 0, jump: true } },
    ])
    expect(padded.toCommand(new Set(['move-1']), 3)).toEqual(padded.toCommand(['move-1'], 3))
  })

  it('merges in iteration order, the later action winning per field', () => {
    const lr = keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 } })
    expect(lr.toCommand(['move-0', 'move-1'], 0)[0]?.payload).toEqual({ x: 1, y: 0, jump: false })
    expect(lr.toCommand(['move-1', 'move-0'], 0)[0]?.payload).toEqual({ x: -1, y: 0, jump: false })
  })

  it('sends the idle payload with nothing held, and nothing without one', () => {
    expect(padded.toCommand([], 1)[0]?.payload).toEqual({ x: 0, y: 0, jump: false })
    expect(keys(Strict, {}).toCommand([], 1)).toEqual([])
  })

  it('ignores an action it does not know', () => {
    expect(padded.toCommand(['jump'], 1)[0]?.payload).toEqual({ x: 0, y: 0, jump: false })
  })
})

describe('keys() attached', () => {
  let source: ReturnType<typeof arrows.attach>
  beforeEach(() => {
    source = arrows.attach(window)
  })
  afterEach(() => {
    source.dispose()
  })

  it('sends the idle payload with nothing held, as one command for this tick', () => {
    expect(source.commands(7)).toEqual([
      { tick: 7, source: 0, seq: 7, type: 'move', payload: { x: 0, y: 0, jump: false } },
    ])
  })

  it('sends no command with nothing held when the schema has no idle payload', () => {
    const strict = keys(Strict, {}).attach(window)
    expect(strict.commands(0)).toEqual([])
    strict.dispose()
  })

  it('merges held keys, the later press winning per field', () => {
    press('ArrowLeft')
    press('Space')
    expect(payloadAt(source)).toEqual([{ x: -1, y: 0, jump: true }])
    press('ArrowRight')
    expect(payloadAt(source)).toEqual([{ x: 1, y: 0, jump: true }])
    lift('ArrowRight')
    expect(payloadAt(source)).toEqual([{ x: -1, y: 0, jump: true }])
  })

  it('keeps a key’s place while it repeats', () => {
    press('ArrowLeft')
    press('ArrowRight')
    press('ArrowLeft')
    expect(payloadAt(source)).toEqual([{ x: 1, y: 0, jump: false }])
  })

  it('stops the page scrolling for a bound key only', () => {
    const bound = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
    const other = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true })
    window.dispatchEvent(bound)
    window.dispatchEvent(other)
    expect(bound.defaultPrevented).toBe(true)
    expect(other.defaultPrevented).toBe(false)
  })

  it('releases everything when the window loses focus', () => {
    press('ArrowLeft')
    source.hold('move-2')
    window.dispatchEvent(new Event('blur'))
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
  })

  it('releases everything when the page is hidden (the Input service, M4.1)', () => {
    press('ArrowLeft')
    source.hold('move-2')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Reflect.deleteProperty(document, 'visibilityState')
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
  })

  it('keeps an action held while another key for it is still down', () => {
    press('ArrowLeft')
    press('KeyA')
    lift('ArrowLeft')
    expect(payloadAt(source)).toEqual([{ x: -1, y: 0, jump: false }])
  })

  it('holds and releases a touch button', () => {
    source.hold('move-1')
    expect(payloadAt(source)).toEqual([{ x: 1, y: 0, jump: false }])
    source.release('move-1')
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
  })

  it('stops listening once disposed', () => {
    source.dispose()
    press('ArrowLeft')
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
  })
})

describe('keys() gamepad (standard mapping)', () => {
  let buttons: boolean[] = []
  beforeEach(() => {
    buttons = []
    Object.defineProperty(window.navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          id: 'Standard Gamepad',
          index: 0,
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
        },
      ],
    })
  })
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'getGamepads')
  })

  it('polls the mapped buttons each tick', () => {
    const source = keys(Move, {}, { pad: { 14: { x: -1 }, 0: { jump: true } } }).attach(window)
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
    buttons[14] = true
    buttons[0] = true
    expect(payloadAt(source)).toEqual([{ x: -1, y: 0, jump: true }])
    buttons[14] = false
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: true }])
    source.dispose()
  })

  it('throws on a pad binding the schema refuses', () => {
    expect(() => keys(Move, {}, { pad: { 0: { x: 9 } } })).toThrow(/pad button 0/)
  })
})
