// The Lock mode and the cycle inputs (GAME-3D.1b part 2, DESIGN.md §11.2, §12.2): `lockInput` over a key map like
// the page's, so the commands are the ones the play screen sends each tick.
import { inputs, keys } from '@mcthaydt/automata-game'
import { CameraTurn, STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import type { Command } from '@mcthaydt/automata-sim'
import type { DragTracker } from '@mcthaydt/automata-ui'
import { describe, expect, it } from 'vitest'
import { Act, Lock, Move } from '../commands.ts'
import { cycleOnDrag, cycleOnFlick, lockInput } from './lock-input.ts'

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

  it('numbers the commands tick × 5 + n, the cycle fifth', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    const commands = input.toCommand(actionsFor(input, 'KeyE'), 7)
    expect(commands.map((command) => [command.type, command.seq])).toEqual([
      ['move', 35],
      ['camera-turn', 36],
      ['lock', 37],
      ['act', 38],
      ['lock-cycle', 39],
    ])
  })

  it('sends a queued cycle on the next tick, once', () => {
    const input = lockInput(map(), { KeyQ: -1, KeyE: 1 })
    input.cycle(1)
    expect(byType(input.toCommand([], 0))['lock-cycle']).toEqual({ dir: 1 })
    expect(byType(input.toCommand([], 1))['lock-cycle']).toBeUndefined()
  })
})

describe('cycleOnDrag (DESIGN.md §11.2: a 40 px camera drag cycles, once per drag)', () => {
  const recorder = () => {
    const calls: string[] = []
    const tracker: DragTracker = {
      down: (id, x) => {
        calls.push(`down ${id} ${x}`)
        return true
      },
      move: (id, x) => void calls.push(`move ${id} ${x}`),
      up: (id) => void calls.push(`up ${id}`),
      cancel: () => void calls.push('cancel'),
    }
    return { calls, tracker }
  }

  it('forwards every sample to the camera’s tracker', () => {
    const { calls, tracker } = recorder()
    const drag = cycleOnDrag(tracker, { cycle: () => {} })
    expect(drag.down(1, 100, { pointerType: 'touch', button: 0 })).toBe(true)
    drag.move(1, 110)
    drag.up(1)
    drag.cancel()
    expect(calls).toEqual(['down 1 100', 'move 1 110', 'up 1', 'cancel'])
  })

  it('cycles once a drag has moved 40 px, by its direction, and not again until a new drag', () => {
    const cycles: number[] = []
    const drag = cycleOnDrag(recorder().tracker, { cycle: (dir) => void cycles.push(dir) })
    drag.down(1, 100, { pointerType: 'touch', button: 0 })
    drag.move(1, 139)
    expect(cycles).toEqual([])
    drag.move(1, 140)
    drag.move(1, 300)
    expect(cycles).toEqual([1])
    drag.up(1)
    drag.down(2, 300, { pointerType: 'mouse', button: 2 })
    drag.move(2, 255)
    expect(cycles).toEqual([1, -1])
  })

  it('ignores a pointer the tracker refused', () => {
    const cycles: number[] = []
    const refusing: DragTracker = { ...recorder().tracker, down: () => false }
    const drag = cycleOnDrag(refusing, { cycle: (dir) => void cycles.push(dir) })
    drag.down(1, 0, { pointerType: 'mouse', button: 0 })
    drag.move(1, 100)
    expect(cycles).toEqual([])
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
