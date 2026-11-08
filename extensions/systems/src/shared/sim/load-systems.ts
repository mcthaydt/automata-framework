// Loads a scene's systems: checks the def against the loaded nav graph, despawns the last scene's
// agents, spawns one entity per agent (at `places[id]`, else its first routine stop, else the origin) and zeroes every
// rule clock. Call it from a game system after the scene's sector map and nav graph are loaded.
import { NavGraphResource } from '@automata/nav/sim'
import type { PlanPoint as Point } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { type SimContext, sortedKeys } from '@automata/sim'
import { SystemsAgent } from './systems.component'
import { emptyPursuit, SystemsNoises, SystemsPursuit, SystemsScene, SystemsState } from './systems.resource'
import { type SystemsDef, systemsDefShape } from './systems.schema'
import { checkSystems } from './systems-checks'
import type { SystemsOptions } from './world'

export function loadSystems(
  ctx: SimContext,
  def: SystemsDef,
  options: SystemsOptions,
  places: Readonly<Record<string, Point>> = {},
): void {
  const checked = systemsDefShape.parse(def)
  const graph = ctx.resource(NavGraphResource)
  const errors: string[] = []
  const hooks = sortedKeys(options.hooks ?? {})
  checkSystems(checked, { hooks, nodes: sortedKeys(graph.nodes) }, (_, message) => errors.push(message))
  if (errors.length > 0)
    throw new Error(`systems: invalid systems for ${checked.scene}:\n${errors.join('\n')}`)
  const state = ctx.resource(SystemsState)
  for (const id of sortedKeys(state.agents)) ctx.despawn((state.agents[id] as { sid: number }).sid)
  state.agents = {}
  state.clocks = {}
  checked.agents.forEach((agent, index) => {
    const first = agent.routine?.[0]?.node
    const at = places[agent.id] ?? (first === undefined ? undefined : graph.nodes[first]) ?? { x: 0, z: 0 }
    const sid = ctx.spawn(...(options.places ?? sectorsPlaces).spawnAt(at), [SystemsAgent, { index }])
    state.agents[agent.id] = {
      sid,
      mode: agent.initial,
      facing: 0,
      moving: false,
      timer: 0,
      replan: 0,
      patrol: 0,
      path: [],
      goal: null,
      own: {},
    }
  })
  for (const rule of checked.rules) state.clocks[rule.id] = 0
  ctx.resource(SystemsNoises).noises = []
  Object.assign(ctx.resource(SystemsPursuit), emptyPursuit())
  ;(ctx.resource(SystemsScene) as { def: SystemsDef | null }).def = checked
}
