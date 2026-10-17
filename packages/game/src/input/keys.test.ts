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
      { id: 'touch-0', label: '←', keys: ['ArrowLeft', 'KeyA'] },
      { id: 'touch-1', label: '→', keys: ['ArrowRight'] },
      { id: 'touch-2', label: 'Space', keys: ['Space'] },
    ])
    expect(arrows.touch).toBe(true)
    expect(keys(Move, {}, { touch: false }).touch).toBe(false)
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
    source.hold('touch-2')
    window.dispatchEvent(new Event('blur'))
    expect(payloadAt(source)).toEqual([{ x: 0, y: 0, jump: false }])
  })

  it('holds and releases a touch button', () => {
    source.hold('touch-1')
    expect(payloadAt(source)).toEqual([{ x: 1, y: 0, jump: false }])
    source.release('touch-1')
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
      value: () => [{ mapping: 'standard', buttons: buttons.map((pressed) => ({ pressed })) }],
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
