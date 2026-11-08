import { resolveExtensions } from '@automata/framework/extension'
import { createSim, defineCommand, definePlugin, defineSystem, type Sim } from '@automata/sim'
import type { Setup, SystemsScene } from '@automata/systems/bots'
import { SystemsState } from '@automata/systems/sim'
import { z } from 'zod'
import { PLUGINS, setup as spawnPlayer } from '../src/app/story-sim.ts'
import { NAV, SYSTEMS } from '../src/features/story/story-content.ts'
import { EXTENSIONS, PLACES } from '../src/features/story/story-extensions.ts'
import { METRE } from '../src/shared/constants.ts'
import { Hero } from '../src/shared/hero.component.ts'
import { LEVEL } from '../src/shared/level/level.ts'
import { Square } from '../src/shared/square.component.ts'

// The story as the bots play it (`systems.pipe.toml` names this module). It is the game's own sim, with the guard's
// file read as it stands on disk: Schematic writes each change before "Check now" runs, so the file is the version that is
// checked. The bots add one command, to stand the player at a point in metres, which a scenario's `place.player` uses.

const Put = defineCommand('fair-play.put', z.strictObject({ x: z.number(), z: z.number() }))
const driver = definePlugin({
  name: 'fair-play',
  dependsOn: ['story'],
  commands: [Put],
  systems: [
    defineSystem('fair-play.put', 'input', (ctx) => {
      for (const { payload } of ctx.commands.of(Put))
        for (const hero of ctx.query(Hero)) hero.set(Square, { x: payload.x * METRE, y: payload.z * METRE })
    }),
  ],
})

/** The player is the first thing the story's setup spawns. */
const PLAYER = 1

const at = (sim: Sim, sid: number): { x: number; z: number } => {
  const here = sim.entity(sid)?.get(Square) as { x: number; y: number }
  return { x: here.x / METRE, z: here.y / METRE }
}

export const scene: SystemsScene = {
  id: SYSTEMS.scene,
  def: SYSTEMS,
  puzzle: {
    scene: SYSTEMS.scene,
    facts: {},
    items: [],
    hotspots: {},
    entry: [{ name: 'start', items: [] }],
    actions: [],
    systemic: [],
    lethal: [],
    goal: [],
    fallback: { '*': 'nothing' },
  },
  options: { places: PLACES },
  nodes: NAV.nodes,
  routes: [],
  player: PLAYER,
  async create(plugins) {
    const sim = await createSim({
      seed: 1,
      plugins: [...PLUGINS, ...resolveExtensions(EXTENSIONS).simPlugins, driver, ...plugins],
      content: LEVEL,
    })
    spawnPlayer(sim)
    return sim
  },
  start(setup: Setup) {
    const player = setup.place?.player
    return player === undefined ? [] : [{ type: Put.id, payload: { x: player.x, z: player.z } }]
  },
  view(sim, time) {
    const state = sim.resource(SystemsState)
    return {
      time,
      dt: 1 / sim.tickHz,
      player: at(sim, PLAYER),
      walking: false,
      lit: false,
      agents: Object.keys(state.agents)
        .sort()
        .map((id) => ({ id, mode: state.agents[id]?.mode ?? '', ...at(sim, state.agents[id]?.sid ?? 0) })),
      hotspots: {},
      items: [],
      facts: {},
    }
  },
}
