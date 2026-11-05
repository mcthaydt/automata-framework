import { defineCommand } from '@mcthaydt/automata-sim'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { inputs } from '#src/features/input/inputs.ts'
import { keys } from '#src/features/input/keys.ts'

// inputs(): several `keys()` maps as one input map, each sending its own command every tick (M3.7b part 3a): a
// game whose sim takes a move, a lock and its action buttons as separate commands.
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step }))
const Lock = defineCommand('lock', z.object({ down: z.boolean() }))
const Swipe = defineCommand('swipe', z.object({ up: z.boolean().default(false) }))

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
const lift = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

const move = keys(Move, { KeyA: { x: -1 }, KeyD: { x: 1 } })
const lock = keys(
  Lock,
  { ShiftLeft: { down: true } },
  { idle: { down: false }, labels: { ShiftLeft: 'Lock' } },
)
const both = inputs(move, lock)

describe('inputs() construction', () => {
  it('throws with no maps', () => {
    expect(() => inputs()).toThrow(/at least one/)
  })

  it('throws when two maps send the same command', () => {
    expect(() => inputs(move, keys(Move, { KeyW: { x: 1 } }))).toThrow(/"move".*twice/)
  })

  it('throws when two maps bind the same key, naming it', () => {
    expect(() => inputs(move, keys(Lock, { KeyA: { down: true } }, { idle: { down: false } }))).toThrow(
      /KeyA/,
    )
  })

  it('throws when two maps define the same action id, naming it', () => {
    // keys() names actions after their command, so only a hand-made map can collide: its binding would be lost.
    const renamed = { ...keys(Lock, { KeyL: { down: true } }, { idle: { down: false } }), command: Swipe }
    expect(() => inputs(lock, renamed)).toThrow(/action "lock-0".*"lock".*"swipe"/)
  })

  it('merges the profiles, the touch buttons and the labels in map order', () => {
    expect(Object.keys(both.profile.bindings)).toEqual(['move-0', 'move-1', 'lock-0'])
    expect(both.profile.id).toBe('move+lock')
    expect(both.touchButtons.map((button) => button.id)).toEqual(['move-0', 'move-1', 'lock-0'])
    expect(both.labels['lock-0']).toBe('Lock')
    expect(both.command).toBe(Move)
    expect(both.touch).toBe(true)
    expect(both.touchMode).toBe('buttons')
  })

  it('leaves out the touch buttons of a map with touch off', () => {
    const quiet = keys(Lock, { ShiftLeft: { down: true } }, { idle: { down: false }, touch: false })
    expect(inputs(move, quiet).touchButtons.map((button) => button.id)).toEqual(['move-0', 'move-1'])
  })

  it('takes swipes when every map does', () => {
    const swipes = keys(Swipe, {}, { gestures: { 'swipe-up': { up: true } } })
    expect(inputs(swipes).touchMode).toBe('swipe')
  })
})

describe('inputs() commands', () => {
  it('sends each map’s command for the held actions, with a seq per command in map order', () => {
    expect(both.toCommand(['lock-0'], 3)).toEqual([
      { tick: 3, source: 0, seq: 6, type: 'move', payload: { x: 0 } },
      { tick: 3, source: 0, seq: 7, type: 'lock', payload: { down: true } },
    ])
  })

  describe('attached', () => {
    let source: ReturnType<typeof both.attach>
    beforeEach(() => {
      source = both.attach(window)
    })
    afterEach(() => {
      source.dispose()
    })

    it('reads one Input for every map: keys, and touch buttons by id', () => {
      press('KeyD')
      expect(source.commands(0).map((command) => command.payload)).toEqual([{ x: 1 }, { down: false }])
      source.hold('lock-0')
      expect(source.commands(1).map((command) => command.payload)).toEqual([{ x: 1 }, { down: true }])
      lift('KeyD')
      source.release('lock-0')
      expect(source.commands(2).map((command) => command.payload)).toEqual([{ x: 0 }, { down: false }])
    })
  })
})
