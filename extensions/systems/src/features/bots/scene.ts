// How a game plugs into the bots and the `systems` pipeline: a `SystemsScene` adapter gives its sim, how a
// run starts, what a bot sees, its routes and how it is retuned. The bots never import a game.
import type { PuzzleDef, Value } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import type { PluginDef, Sim } from '@automata/sim'
import type { SystemsDef } from '../../shared/sim/systems.schema'
import type { SystemsOptions } from '../../shared/sim/world'
import type { BotOptions } from './bot'
import type { BotView, Order, PlanStep } from './view'

/** A way through the scene, as a bot's plan (a solver route, once the solver feeds them). */
export interface Route {
  readonly name: string
  readonly plan: readonly PlanStep[]
}
/** Where a run starts: agents and the player placed, facts set, items carried. */
export interface Setup {
  readonly place?: Readonly<Record<string, Point>> | undefined
  readonly facts?: Readonly<Record<string, Value>> | undefined
  readonly items?: readonly string[] | undefined
}
export interface SystemsScene {
  readonly id: string
  readonly def: SystemsDef
  readonly puzzle: PuzzleDef
  /** The options the game gives `createSystems` (a run's watcher asks its derived facts). */
  readonly options: SystemsOptions
  /** The scene's nav nodes, for a floor step at a node (`floor.bottle@cmid`). */
  readonly nodes: Readonly<Record<string, Point>>
  readonly routes: readonly Route[]
  /** The player's entity in every sim `create` makes. */
  readonly player: number
  /** The scene's tactics as bot options (threats, the light, the keypad and its codes, evading). */
  readonly bot?: Partial<Omit<BotOptions, 'player' | 'seed' | 'plan'>> | undefined
  /** A sim with the game's plugins and `plugins` (a run's watcher). */
  create(plugins: readonly PluginDef[]): Promise<Sim>
  /** The commands of a run's first step: the scene loaded with `setup`. */
  start(setup: Setup): readonly Order[]
  /** What a bot sees now; `time` is the run's seconds. */
  view(sim: Sim, time: number): BotView
  /** The scene with one tunable set to `value`; a scene without it cannot be swept. */
  retune?(name: string, value: number): SystemsScene
}

/** A scenario's or a route's actions as plan steps: puzzle action ids, a floor verb at a node with `@node`, `hide:<spot>`. */
export function stepsFor(scene: SystemsScene, actions: readonly string[]): PlanStep[] {
  return actions.map((token) => {
    if (token.startsWith('hide:')) return { action: token, at: token.slice(5) }
    const [id, node] = token.split('@') as [string, string | undefined]
    const action = scene.puzzle.actions.find((a) => a.id === id)
    if (action === undefined) throw new Error(`${scene.id}: no action ${id} in the puzzle`)
    const step: { -readonly [K in keyof PlanStep]: PlanStep[K] } = { action: id, at: action.at }
    if (typeof action.use === 'string') step.held = action.use
    else if (action.use !== undefined) step.pair = [action.use[0], action.use[1]]
    if (node !== undefined) {
      const point = scene.nodes[node]
      if (point === undefined) throw new Error(`${scene.id}: no node ${node} for ${token}`)
      step.point = { x: point.x, z: point.z }
    }
    return step
  })
}
