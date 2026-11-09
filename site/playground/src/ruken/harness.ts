// What a playground frame runs an example with. Browser code: the frame's build
// bundles it with the runtime, so the game, the sim and the fake host here are the same modules the example imports.
import type { DefinedGame } from '@automataframework/automata'
import { type RuntimeHandle, runGame } from '@automataframework/automata'
import { createSim, type Sim } from '@automataframework/automata-sim'
import { createReplayStepper, type ReplayStepper, unpackReplay } from '@automataframework/automata-sim/replay'
import { streamCompression } from '@automataframework/automata-sim/testing'
import type { HostSettings } from '@automataframework/examples-runner/header'
import { createFakeHost } from '@ruken/sdk-host/testing'
import { startAtPlay } from '../start-at-play.ts'
import { fakeHostOptions } from './fake-host-options.ts'

// The fake host's clock is the frame's own: it times host replies, never the sim (the sim has no clock).
const frameClock = {
  epochMs: () => Date.now(),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface RunExampleOptions {
  readonly root: HTMLElement
  /** The example's `Host:` header. */
  readonly host: HostSettings | undefined
  /** Hears a boot failure or a running sim's fault (the runtime's `seams.onFailure`). */
  readonly onFailure: (cause: unknown) => void
}

/**
 * Starts a `defineGame` result in this frame against Ruken's fake host in its in-memory mode, as the framework's own
 * tests run games (`openHostingTest`): no Ruken page to wait for, saves that live in this frame's memory. It enters the
 * play screen at once (`startAtPlay`), so an edit shows without a press on Play. It calls the
 * runtime's `runGame` with seams, which `startGame` keeps for tests (PLAY-D11), so no public API changes.
 */
export function runExample(game: DefinedGame<unknown>, options: RunExampleOptions): RuntimeHandle {
  const settings = fakeHostOptions(options.host)
  const host = createFakeHost({
    gameOrigin: location.origin,
    gameId: game.hosting.gameId,
    clock: frameClock,
    ...settings.create,
  })
  host.fakes.saves.offline = settings.offline
  host.fakes.leaderboards.offline = settings.offline
  const { gameEnv } = host
  if (gameEnv === null) throw new Error('the playground needs the in-memory fake host')
  const handle = runGame({
    ...game,
    content: startAtPlay(game),
    root: options.root,
    seams: { ...game.seams, sdkEnv: () => gameEnv, onFailure: options.onFailure },
  })
  return {
    shutdown: async () => {
      await handle.shutdown()
      host.dispose()
    },
  }
}

/**
 * A sim set up as the examples' goldens are recorded (`examples.parity.test.ts`): the game's plugins, seed and `setup`,
 * at tick 0, without the sim's content, so a hash here is comparable with the framework's parity suite.
 */
export async function exampleSim(game: DefinedGame<unknown>): Promise<Sim> {
  const { plugins, seed, setup } = game.sim
  const sim = await createSim({ plugins: [...plugins], seed })
  setup?.(sim)
  return sim
}

/** Runs the example's sim headless for `ticks` steps with no input, as its golden was recorded, and hashes it. */
export async function hashRun(game: DefinedGame<unknown>, ticks: number): Promise<string> {
  const sim = await exampleSim(game)
  try {
    for (let tick = 0; tick < ticks; tick += 1) sim.step([])
    return sim.hash()
  } finally {
    sim.dispose()
  }
}

export type GoldenCheck =
  | { readonly golden: 'pass'; readonly ticks: number; readonly hash: string }
  | { readonly golden: 'diverged'; readonly ticks: number; readonly hash: string; readonly tick: number }

/** The tick of the first divergence: each tick against the golden's reference hashes, else at its checks. */
function firstDivergence(
  stepper: ReplayStepper,
  references: readonly string[] | undefined,
): number | undefined {
  let index = 0
  while (!stepper.done) {
    const { tick, check } = stepper.step()
    const reference = references?.[index]
    index += 1
    if (reference !== undefined && stepper.sim.hash() !== reference) return tick
    if (check !== undefined && check.expected !== check.actual) return tick
  }
  return undefined
}

/**
 * Replays the example's golden (`.replay` bytes) in this browser, as the framework's parity suite does in Node,
 * Chromium, WebKit and Firefox. A divergence is a cross-engine bug to report, never something to re-record.
 */
export async function checkGolden(game: DefinedGame<unknown>, bytes: Uint8Array): Promise<GoldenCheck> {
  const replay = await unpackReplay(bytes, streamCompression)
  // Replayed with the plugins alone, as the parity suite replays the examples' goldens.
  const stepper = await createReplayStepper(replay, { plugins: game.sim.plugins })
  try {
    const diverged = firstDivergence(stepper, replay.reference?.hashes)
    const ticks = stepper.tick - replay.header.startTick
    const hash = stepper.sim.hash()
    return diverged === undefined
      ? { golden: 'pass', ticks, hash }
      : { golden: 'diverged', ticks, hash, tick: diverged }
  } finally {
    stepper.dispose()
  }
}
