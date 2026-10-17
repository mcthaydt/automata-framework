// I-a (M4 spec §13): one scripted 120-tick run, played three times, by the keyboard, a standard pad and touch
// buttons, through `keys().attach` (the Input service and `toCommand`) into a real sim. Shared by the Node test
// and the browser parity test so both play exactly the same script.
import {
  type Command,
  createSim,
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { type InputMap, keys } from '../keys.ts'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step }))
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) {
      const { x, y } = body.get(Body)
      body.set(Body, { x: x + payload.x * 2, y: y + payload.y * 2 })
    }
})
const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

/** core-input-keys's map: one action per direction, on a key, a D-pad button and a touch button. */
export const deviceMap: InputMap = keys(
  Move,
  { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 }, ArrowUp: { y: -1 }, ArrowDown: { y: 1 } },
  { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
)

type Direction = 'left' | 'right' | 'up' | 'down'
const KEY: Record<Direction, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
}
const PAD: Record<Direction, number> = { left: 14, right: 15, up: 12, down: 13 }
const ACTION: Record<Direction, string> = { left: 'move-0', right: 'move-1', up: 'move-2', down: 'move-3' }

/** The script: twelve ticks per beat, cycling left, up, right, down and a rest, with left and up held together. */
function heldAt(tick: number): Direction[] {
  switch (Math.floor(tick / 12) % 6) {
    case 0:
      return ['left']
    case 1:
      return ['left', 'up']
    case 2:
      return ['right']
    case 3:
      return ['down']
    case 4:
      return []
    default:
      return ['up']
  }
}

/**
 * The sim hash the script ends on, in every engine (pinned 2026-10-17 from the Node run, `pnpm --filter
 * @mcthaydt/automata-game exec vitest run --project unit src/input/keys.devices.test.ts`). A mismatch is a defect
 * to find, never a value to update per engine.
 */
export const DEVICE_RUN_HASH = 'df59895cfb81d1a0'

export type Device = 'keyboard' | 'gamepad' | 'touch'

/** Plays the script on `device` over `target` and returns the commands sent and the sim's final hash. */
export async function runOn(device: Device, target: Window): Promise<{ commands: Command[]; hash: string }> {
  const buttons: boolean[] = []
  const nav = target.navigator as Navigator & { getGamepads?: unknown }
  const hadPads = Object.getOwnPropertyDescriptor(nav, 'getGamepads')
  Object.defineProperty(nav, 'getGamepads', {
    configurable: true,
    value: () => [{ index: 0, mapping: 'standard', buttons: buttons.map((pressed) => ({ pressed })) }],
  })
  const source = deviceMap.attach(target)
  const sim = await createSim({ plugins: [square], seed: 1 })
  sim.spawn([[Body, { x: 160, y: 90 }]])
  const commands: Command[] = []
  let held: Direction[] = []
  const set = (direction: Direction, down: boolean): void => {
    if (device === 'keyboard')
      target.dispatchEvent(
        new KeyboardEvent(down ? 'keydown' : 'keyup', { code: KEY[direction], cancelable: true }),
      )
    else if (device === 'gamepad') buttons[PAD[direction]] = down
    else if (down) source.hold(ACTION[direction])
    else source.release(ACTION[direction])
  }
  try {
    for (let tick = 0; tick < 120; tick++) {
      const wanted = heldAt(tick)
      for (const direction of held) if (!wanted.includes(direction)) set(direction, false)
      for (const direction of wanted) if (!held.includes(direction)) set(direction, true)
      held = wanted
      const step = source.commands(sim.tick)
      commands.push(...step)
      sim.step(step)
    }
    return { commands, hash: sim.hash() }
  } finally {
    source.dispose()
    sim.dispose()
    if (hadPads === undefined) Reflect.deleteProperty(nav, 'getGamepads')
    else Object.defineProperty(nav, 'getGamepads', hadPads)
  }
}
