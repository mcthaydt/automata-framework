import { PuzzleState } from '@automata/puzzle/sim'
import type { SimContext } from '@automata/sim'
import { followPlayer, SystemsMode, type SystemsOptions, type SystemsWorld } from '@automata/systems/sim'
import { Night } from './night.resource.ts'

type Hooks = NonNullable<SystemsOptions['hooks']>

/** A tuned number of the creature's file (`tunables.<name>.value`), or `fallback` when the file leaves it out. */
const tuned = (w: SystemsWorld, name: string, fallback: number): number =>
  w.def.tunables[name]?.value ?? fallback

/** Changes the figure's mode and says so, as the systems' own transitions do. */
export function setMode(w: SystemsWorld, id: string, mode: string): void {
  const record = w.state.agents[id]
  if (record === undefined || record.mode === mode) return
  w.ctx.emit(SystemsMode, { agent: id, from: record.mode, to: mode })
  record.mode = mode
}

/** The figure, or nothing when the file has none under that id. */
const FIGURE = 'nurse'

/**
 * What the creature's file calls and data cannot say (audit 7): `wake` (lights out: she steps out of the far end of the
 * corridor), `vigil` (the clock of her watch; it ends unless she is hunting), `leave` (she goes back and is gone) and
 * `replan` (hunting, she routes to Ada again every so often: the systems' re-route on a clock). `stop` is built in. All
 * the numbers are the file's, read where they are used, so the Tuner and Schematic change them with no code.
 */
/** What the night asks of the rest of the game: a checkpoint when the lights go, and what a catch does. */
export interface NightOptions {
  readonly checkpoint: (ctx: SimContext) => void
  /** Starts a cutscene (the creature's rules only say one should play; the sim starts it here). */
  readonly start: (ctx: SimContext, id: string) => void
  /** Whether a cutscene is playing: the night's clocks wait (the old game ran no rules in a cutscene). */
  readonly playing: (ctx: SimContext) => boolean
  readonly caught: (w: SystemsWorld) => void
}

export const nightHooks = (options: NightOptions): Hooks => ({
  caught: options.caught,
  wake(w) {
    const figure = w.state.agents[FIGURE]
    const end = w.graph.nodes.end
    if (figure === undefined || end === undefined) return
    const night = w.ctx.resource(Night)
    night.vigil = 0
    night.over = false
    // She stands at the far end of the corridor while the cutscene tells it; `night.rouse` sets her walking when it is over.
    night.waking = true
    w.at[FIGURE] = { x: end.x, z: end.z }
    Object.assign(figure, { patrol: 0, path: [], goal: null, timer: 1.5 })
    setMode(w, FIGURE, 'dormant')
    // A checkpoint first, so a practice catch comes back here.
    options.checkpoint(w.ctx)
    options.start(w.ctx, 'lightsOut')
  },
  vigil(w) {
    if (options.playing(w.ctx)) return
    const night = w.ctx.resource(Night)
    night.vigil += w.ctx.dt
    const mode = w.state.agents[FIGURE]?.mode
    const hunting = mode === 'hunt' || mode === 'follow'
    if (!night.over && night.vigil >= tuned(w, 'vigil', 35) && !hunting) night.over = true
  },
  leave(w) {
    const figure = w.state.agents[FIGURE]
    if (figure === undefined) return
    figure.path = []
    figure.goal = null
    w.ctx.resource(PuzzleState).facts.figureGone = true
  },
  replan: (w, agent) => followPlayer(tuned(w, 'replan', 0.4))(w, agent),
})
