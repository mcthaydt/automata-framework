// The Lock mode and the cycle inputs (GAME-3D.1b part 2, DESIGN.md §11.2, §12.2): `lockInput` over a key map like
// the page's, so the commands are the ones the play screen sends each tick.
import { type AnalogReading, inputs, keys } from '@mcthaydt/automata-game'
import { CameraTurn, STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import type { Command } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Act, Lock, Move } from '../commands.ts'
import { cycleOnDrag, cycleOnFlick, DRAG_REST_TICKS, lockInput } from './lock-input.ts'

const map = () =>
  inputs(
    keys(Move, { KeyW: { y: -STICK_MAX } }, { idle: { x: 0, y: 0 } }),
    keys(CameraTurn, { KeyQ: { units: -364 }, KeyE: { units: 364 } }, { idle: { units: 0 } }),
    keys(Lock, { ShiftLeft: { down: true, mode: 'hold' } }, { idle: { down: false, mode: 'hold' } }),
    keys(
      Act,
      { KeyJ: { slash: true } },
      { idle: { slash: false, guard: false, point: false, pickup: false, action: false, item: false } },
    ),
  )

/** The action ids bound to `codes`. */
const actionsFor = (input: ReturnType<typeof lockInput>, ...codes: string[]) =>
  Object.entries(input.profile.bindings)
    .filter(([, binding]) => binding.keys.some((code) => codes.includes(code)))
    .map(([id]) => id)

const byType = (commands: readonly Command[]) =>
  Object.fromEntries(commands.map((command) => [command.type, command.payload]))

describe('lockInput (GAME-3D.1b part 2)', () => {
  it('sends the saved Lock mode with every lock command, toggle by default', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    expect(byType(input.toCommand([], 0)).lock).toEqual({ down: false, mode: 'toggle' })
    input.mode = 'hold'
    expect(byType(input.toCommand(actionsFor(input, 'ShiftLeft'), 1)).lock).toEqual({
      down: true,
      mode: 'hold',
    })
  })

  it('sends one lock-cycle on a cycle key’s first tick, beside the camera turn, and again on a new press', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    const q = actionsFor(input, 'KeyQ')
    const first = byType(input.toCommand(q, 0))
    expect(first['lock-cycle']).toEqual({ dir: -1 })
    expect(first['camera-turn']).toEqual({ units: -364 })
    const held = byType(input.toCommand(q, 1))
    expect(held['lock-cycle']).toBeUndefined()
    expect(held['camera-turn']).toEqual({ units: -364 })
    expect(byType(input.toCommand([], 2))['lock-cycle']).toBeUndefined()
    expect(byType(input.toCommand(q, 3))['lock-cycle']).toEqual({ dir: -1 })
    expect(byType(input.toCommand(actionsFor(input, 'KeyE'), 4))['lock-cycle']).toEqual({ dir: 1 })
  })

  it('numbers the commands tick × 6 + n, the cycle fifth and an equip sixth', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    input.equip('sling')
    const commands = input.toCommand(actionsFor(input, 'KeyE'), 7)
    expect(commands.map((command) => [command.type, command.seq])).toEqual([
      ['move', 42],
      ['camera-turn', 43],
      ['lock', 44],
      ['act', 45],
      ['lock-cycle', 46],
      ['equip', 47],
    ])
  })

  it('sends a queued equip on the next tick, once, the last one asked for (GAME-3D.1e part 5b)', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    input.equip('sling')
    input.equip('hookchain')
    expect(byType(input.toCommand([], 0)).equip).toEqual({ item: 'hookchain' })
    expect(byType(input.toCommand([], 1)).equip).toBeUndefined()
  })

  it('sends a queued cycle on the next tick, once', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    input.cycle(1)
    expect(byType(input.toCommand([], 0))['lock-cycle']).toEqual({ dir: 1 })
    expect(byType(input.toCommand([], 1))['lock-cycle']).toBeUndefined()
  })
})

describe('cycleOnDrag (DESIGN.md §11.2: a 40 px camera drag cycles, once per drag)', () => {
  const run = (...samples: number[]) => {
    const cycles: number[] = []
    const drag = cycleOnDrag({ cycle: (dir) => void cycles.push(dir) })
    for (const px of samples) drag(px)
    return cycles
  }

  it('cycles once a drag has summed 40 px, by its direction', () => {
    expect(run(10, 10, 10, 9)).toEqual([])
    expect(run(10, 10, 10, 10)).toEqual([1])
    expect(run(-30, -10)).toEqual([-1])
  })

  it('cycles once per drag, and again after the drag has rested', () => {
    const rest = Array.from({ length: DRAG_REST_TICKS }, () => 0)
    expect(run(50, 50, 50)).toEqual([1])
    expect(run(50, 0, 0, 50)).toEqual([1])
    expect(run(50, ...rest, -50)).toEqual([1, -1])
  })
})

describe('lockInput with an analog reading (GAME-3D.1h)', () => {
  const reading = (over: { right?: number; drag?: number } = {}): AnalogReading => ({
    stick: (side) => ({ x: side === 'right' ? (over.right ?? 0) : 0, y: 0 }),
    cameraDrag: () => over.drag ?? 0,
    camera: { degPerPixel: 0.25, invert: false },
  })

  it('cycles on a drag of 40 px and on a right-stick flick past 0.7, once each', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    expect(byType(input.toCommand([], 0, reading({ drag: 39 })))['lock-cycle']).toBeUndefined()
    expect(byType(input.toCommand([], 1, reading({ drag: 1 })))['lock-cycle']).toEqual({ dir: 1 })
    expect(byType(input.toCommand([], 2, reading({ drag: 40 })))['lock-cycle']).toBeUndefined()
    const flick = byType(input.toCommand([], 3, reading({ right: -100 })))
    expect(flick['lock-cycle']).toEqual({ dir: -1 })
    expect(byType(input.toCommand([], 4, reading({ right: -127 })))['lock-cycle']).toBeUndefined()
  })
})

describe('cycleOnFlick (DESIGN.md §11.2: a right-stick flick past 0.7 cycles)', () => {
  it('cycles once past ±0.7 and again only after the stick comes back inside', () => {
    const cycles: number[] = []
    const flick = cycleOnFlick({ cycle: (dir) => void cycles.push(dir) })
    flick(0.69)
    expect(cycles).toEqual([])
    flick(0.7)
    flick(1)
    expect(cycles).toEqual([1])
    flick(0.2)
    flick(-0.9)
    expect(cycles).toEqual([1, -1])
  })
})
