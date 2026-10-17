import { type Command, createSim } from '@mcthaydt/automata-sim'
import { emberwick } from './game.ts'
import { routeInputs } from './golden.ts'
import type { MoveInput } from './sim/index.ts'

/** The keys the golden route holds: one per direction, Z for jump. */
const keysFor = (input: MoveInput): string[] => [
  ...(input.x === -1 ? ['ArrowLeft'] : input.x === 1 ? ['ArrowRight'] : []),
  ...(input.jump ? ['KeyZ'] : []),
]

/** Just enough of a window for `keys()`: key events and no gamepads. */
function fakeWindow(): Window {
  const target = new EventTarget() as EventTarget & { navigator: { getGamepads: () => [] } }
  target.navigator = { getGamepads: () => [] }
  return target as unknown as Window
}

function press(target: Window, type: 'keydown' | 'keyup', code: string): void {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'code', { value: code })
  target.dispatchEvent(event)
}

/**
 * Replays the golden route the way `startGame` plays Emberwick: a sim made from the game's own sim spec (seed,
 * plugins, the room as content, Wick placed by `setup`), stepped each tick with the command its input map
 * builds from the keys held. Reports what the golden tests compare.
 */
export async function runGolden(): Promise<{
  hash: string
  goalTicks: number[]
  rejected: number
  inputs: MoveInput[]
  commands: Command[]
  seed: number
  ticks: number
}> {
  const { plugins, seed, content, setup } = emberwick.sim
  const sim = await createSim({ plugins: [...plugins], seed, content })
  setup?.(sim)
  const startTick = sim.tick
  const target = fakeWindow()
  const source = emberwick.input?.attach(target)
  if (source === undefined) throw new Error('emberwick has no input map')

  const inputs = routeInputs()
  const commands: Command[] = []
  const goalTicks: number[] = []
  let rejected = 0
  let held: string[] = []
  for (const input of inputs) {
    const wanted = keysFor(input)
    for (const code of held) if (!wanted.includes(code)) press(target, 'keyup', code)
    for (const code of wanted) if (!held.includes(code)) press(target, 'keydown', code)
    held = wanted
    const step = source.commands(sim.tick)
    commands.push(...step)
    const result = sim.step(step)
    rejected += result.rejected.length
    for (const event of result.events) if (event.type === 'goal.reached') goalTicks.push(result.tick)
  }
  source.dispose()
  const hash = sim.hash()
  const ticks = sim.tick - startTick
  sim.dispose()
  return { hash, goalTicks, rejected, inputs, commands, seed: sim.seed, ticks }
}
