// One systems call's view of the sim (a step, or a noise heard): the def, the resources, the player's point and every
// agent's plan position read from its entity's `InSector`, the movement and sight queries, and the options. `commit`
// writes the moved positions back. Hooks, derived facts and refused steps receive it as `SystemsWorld`.
import type { NavGraph } from '@mcthaydt/automata-nav/sim'
import { type Blocked, blockedBy, NavDoors, NavGraphResource } from '@mcthaydt/automata-nav/sim'
import type { PuzzleOptions, Value } from '@mcthaydt/automata-puzzle/sim'
import { InSector, type Point, type ResolvedMap, resolvedMap } from '@mcthaydt/automata-sectors/sim'
import { type SimContext, sortedKeys } from '@mcthaydt/automata-sim'
import { SystemsMode } from './systems.event'
import {
  type AgentRecord,
  type Noise,
  type PursuitValue,
  SystemsEnv,
  type SystemsEnvValue,
  SystemsNoises,
  SystemsPursuit,
  SystemsScene,
  SystemsState,
  type SystemsStateValue,
} from './systems.resource'
import type { AgentDef, SystemsDef } from './systems.schema'

/** What the game gives `createSystems` (SY-D4): sim functions for what data cannot say. */
export interface SystemsOptions {
  /** Named functions for `{ call }`. `stop` is built in (it drops the agent's path). */
  readonly hooks?: Readonly<Record<string, (w: SystemsWorld, agent: string | null) => void>>
  /** Facts derived from the game's state: `self.<name>` for an agent, the bare name for a rule. Read, never set. */
  readonly derived?: Readonly<Record<string, (w: SystemsWorld, agent: string | null) => Value>>
  /** A step the agent will not take (into light, say): it waits instead. */
  readonly refuses?: (w: SystemsWorld, agent: string, to: Point) => boolean
  /** Puzzle's mapped facts: the same object the game gives puzzle (SY-D5). */
  readonly facts?: PuzzleOptions['facts']
  /** The game's movement query (walls, steps and its boxes); default sectors' walls and nav's doors (SY-D8). */
  readonly blocked?: (ctx: SimContext, doors: Readonly<Record<string, boolean>>) => Blocked
  /** The game's sight query for a sense with `wallsOnly` (the default); default sectors' walls (SY-D8). */
  readonly sight?: (ctx: SimContext, doors: Readonly<Record<string, boolean>>) => Blocked
}

export interface SystemsWorld {
  readonly ctx: SimContext
  readonly def: SystemsDef
  readonly options: SystemsOptions
  readonly state: SystemsStateValue
  readonly noises: Noise[]
  readonly pursuit: PursuitValue
  readonly env: SystemsEnvValue
  readonly graph: NavGraph
  readonly map: ResolvedMap
  /** Walking: walls, steps, doors and the game's obstacles. */
  readonly walk: Blocked
  /** Line of sight past the walls. */
  readonly sight: Blocked
  /** The player's plan point (the origin with no player). */
  readonly player: Point
  /** Each agent's plan position by id; `commit` writes them to the entities. */
  readonly at: Record<string, { x: number; z: number }>
  /** The noise being heard, while the systems react to one. */
  hearing?: Noise | undefined
  readonly defs: Readonly<Record<string, AgentDef>>
}

/** The world for one call, or undefined when no scene is loaded. */
export function worldOf(ctx: SimContext, options: SystemsOptions): SystemsWorld | undefined {
  const def = ctx.resource(SystemsScene).def
  if (def === null) return undefined
  const state = ctx.resource(SystemsState)
  const env = ctx.resource(SystemsEnv)
  const doors = ctx.resource(NavDoors).open
  const map = resolvedMap(ctx)
  const player = env.player === 0 ? undefined : ctx.entity(env.player)?.get(InSector)
  const at: Record<string, { x: number; z: number }> = {}
  for (const id of sortedKeys(state.agents)) {
    const place = ctx.entity((state.agents[id] as AgentRecord).sid)?.get(InSector)
    at[id] = { x: place?.x ?? 0, z: place?.z ?? 0 }
  }
  const defs: Record<string, AgentDef> = {}
  for (const agent of def.agents) defs[agent.id] = agent
  const walls: Blocked = {
    segment: (a, b, margin) => map.segmentBlocked(a, b, margin),
    open: (d) => doors[d] === true,
  }
  return {
    ctx,
    def,
    options,
    state,
    noises: ctx.resource(SystemsNoises).noises,
    pursuit: ctx.resource(SystemsPursuit),
    env,
    graph: ctx.resource(NavGraphResource),
    map,
    walk: options.blocked?.(ctx, doors) ?? blockedBy(map, doors),
    sight: options.sight?.(ctx, doors) ?? walls,
    player: { x: player?.x ?? 0, z: player?.z ?? 0 },
    at,
    defs,
  }
}

/** Writes every agent's moved position to its entity. */
export function commit(w: SystemsWorld): void {
  for (const id of sortedKeys(w.at)) {
    const record = w.state.agents[id]
    const place = w.at[id]
    if (record === undefined || place === undefined) continue
    w.ctx.entity(record.sid)?.set(InSector, { x: place.x, z: place.z })
  }
}

/** Changes an agent's mode, and nothing else (a transition's effects say what else changes); says so when it did. */
export function setMode(w: SystemsWorld, id: string, mode: string): void {
  const record = w.state.agents[id]
  if (record === undefined || record.mode === mode) return
  const from = record.mode
  record.mode = mode
  w.ctx.emit(SystemsMode, { agent: id, from, to: mode })
}
