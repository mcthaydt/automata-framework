// A bot that plays the prologue the way a player's input does: taps on hotspots, combining two items, typing the code, the
// lamp's switch, and waiting out a cutscene. It sends the commands the input sends and nothing else (never a private door
// into the sim), so a run is a replay of a person's. Tests and tools only.
import { CutsceneStarted, CutsceneState } from '@automata/cutscenes/sim'
import { InteractRefused, InteractUsed } from '@automata/interact/sim'
import { boot, type Game } from './harness.ts'

/** One thing the bot does. */
export type BotStep =
  | { readonly tap: string; readonly held?: string }
  | { readonly combine: readonly [string, string] }
  | { readonly code: string }
  | { readonly lamp: true }
  /** Walk to a hiding place and stay until the puzzle fact `until` is true. */
  | { readonly hideUntil: string; readonly spot: string }
  /** Stay still for some seconds. */
  | { readonly wait: number }

export interface BotResult {
  /** The scene was played to its end: Ada rested and the last cutscene ended. */
  readonly finished: boolean
  readonly ticks: number
  readonly hash: string
  /** How many times the figure's touch found Ada and `found` played (a touch while a cutscene holds input is not one). */
  readonly caught: number
  /** What stopped it, when it did not finish. */
  readonly stuck?: string
}

const MAX_SECONDS = 60

/** Steps until no cutscene is playing. The bot never skips one: it waits (a cutscene is part of the game). */
function settle(game: Game): void {
  for (let i = 0; i < 60 * MAX_SECONDS && game.sim.resource(CutsceneState).id !== null; i += 1) game.send([])
}

/** Steps until `done` holds or the time is up; true when it held. */
function until(game: Game, done: () => boolean, seconds = MAX_SECONDS): boolean {
  for (let i = 0; i < 60 * seconds; i += 1) {
    if (done()) return true
    game.send([])
  }
  return done()
}

function perform(game: Game, step: BotStep): string | undefined {
  settle(game)
  if ('tap' in step) {
    const used = game.events(InteractUsed).length
    const refused = game.events(InteractRefused).length
    game.tap(step.tap, step.held === undefined ? {} : { held: step.held })
    const arrived = until(
      game,
      () => game.events(InteractUsed).length > used || game.events(InteractRefused).length > refused,
    )
    if (!arrived) return `never reached ${step.tap}`
    const why = game.events(InteractRefused).slice(refused)[0] as { reason: string } | undefined
    if (why !== undefined) {
      const at = game.ada()
      return `${step.tap} was refused (${why.reason}) with Ada at (${at.x.toFixed(2)}, ${at.z.toFixed(2)}) after ${(game.sim.tick / 60).toFixed(0)} s`
    }
  } else if ('combine' in step) game.combine(step.combine[0], step.combine[1])
  else if ('code' in step) game.code(step.code)
  else if ('lamp' in step) game.lamp()
  else if ('wait' in step) game.hold(step.wait)
  else {
    const err = perform(game, { tap: step.spot })
    if (err !== undefined) return err
    if (!until(game, () => game.fact(step.hideUntil) === true, 120))
      return `${step.hideUntil} never came true`
  }
  settle(game)
  return undefined
}

/** Plays `route` from a fresh game on `seed`, and says how it went. */
export async function playRoute(route: readonly BotStep[], seed = 1): Promise<BotResult> {
  const game = await boot(seed)
  let stuck: string | undefined
  for (const step of route) {
    stuck = perform(game, step)
    if (stuck !== undefined) break
  }
  const caught = game
    .events(CutsceneStarted)
    .filter((started) => (started as { id: string }).id === 'found').length
  const finished =
    stuck === undefined && game.fact('rested') === true && game.sim.resource(CutsceneState).id === null
  const result = {
    finished,
    ticks: game.sim.tick,
    hash: game.sim.hash(),
    caught,
    ...(stuck === undefined ? {} : { stuck }),
  }
  game.dispose()
  return result
}
