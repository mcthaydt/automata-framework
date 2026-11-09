// A `SystemsScene` for the bots' tests: the ward game (the clinic's map and graph, the toy watchman) with a small
// puzzle: take the key from the reception desk and open the hall's exit with it; a bottle thrown into the corridor
// lures the watchman (the `watchmanLured` systemic). The player walks at 3 m/s.
import { NavRoutes } from '@automata/nav/sim'
import { clinicGraph } from '@automata/nav/testing/clinic'
import { type PuzzleDef, PuzzleState } from '@automata/puzzle/sim'
import { InSector, type Point } from '@automata/sectors/sim'
import type { Sim } from '@automata/sim'
import type { BotView, Order } from '../entries/bots'
import { type Setup, type SystemsScene, stepsFor } from '../features/bots/scene'
import { SystemsState } from '../shared/sim/systems.resource'
import type { SystemsDef } from '../shared/sim/systems.schema'
import { sceneOf, watchman } from './toy'
import { createWardGame, fact, items, load, move } from './ward-game'

const NODES = clinicGraph().nodes as Readonly<Record<string, Point>>
/** The player is the first entity the ward game spawns. */
const PLAYER = 1

export const WARD_PUZZLE: PuzzleDef = {
  scene: 'ward',
  facts: { out: false },
  items: ['key', 'bottle'],
  hotspots: { desk: { x: 1.75, z: 1.45 }, exit: { x: 0, z: 4.8 }, locker: { x: 3.6, z: -5 } },
  entry: [{ name: 'start', items: [] }],
  actions: [
    { id: 'desk.key', at: 'desk', when: [{ not: { has: 'key' } }], then: [{ give: 'key' }], say: 'deskKey' },
    { id: 'exit.open', at: 'exit', use: 'key', then: [{ set: 'out', to: true }], say: 'exitOpen' },
    {
      id: 'floor.bottle',
      at: 'floor',
      use: 'bottle',
      then: [{ take: 'bottle' }, { noise: { at: { x: 0.3, z: -4 }, loudness: 9, kind: 'bottle' } }],
      say: 'smash',
    },
  ],
  systemic: [
    {
      id: 'watchmanLured',
      note: 'A bottle in the corridor draws him to it.',
      enables: [],
      via: ['floor.bottle'],
    },
  ],
  lethal: [],
  goal: [{ fact: 'out', is: true }],
  fallback: { '*': 'nothing' },
}

export const WARD_SYSTEMS = (): SystemsDef =>
  sceneOf(watchman(), {
    scenarios: [
      {
        id: 'bottleLure',
        claims: 'watchmanLured',
        setup: {
          place: { player: { x: 0, z: 1.5 }, watchman: NODES.end as Point },
          items: ['bottle'],
          actions: ['floor.bottle@hallN'],
        },
        policy: 'scripted',
        expect: { condition: [{ at: 'cmid' }], within: 8, probability: 0.95 },
        seeds: 4,
      },
      {
        id: 'seenInCorridor',
        setup: { place: { player: { x: 0, z: -2.4 }, watchman: NODES.cmid as Point } },
        policy: 'scripted',
        expect: { condition: [{ mode: 'hunt' }], within: 3, probability: 1 },
        seeds: 3,
      },
    ],
  })

export function wardScene(def: SystemsDef = WARD_SYSTEMS()): SystemsScene {
  const scene: SystemsScene = {
    id: 'ward',
    def,
    puzzle: WARD_PUZZLE,
    options: {},
    nodes: NODES,
    routes: [],
    player: PLAYER,
    async create(plugins) {
      const game = await createWardGame(def, {}, ['shriek'], { puzzle: WARD_PUZZLE, walker: 3, plugins })
      if (game.player !== PLAYER) throw new Error(`ward: the player is entity ${game.player}, not ${PLAYER}`)
      return game.sim
    },
    start(setup: Setup): readonly Order[] {
      const { player, ...agents } = setup.place ?? {}
      const orders: Order[] = [load(agents), fact('power', false), fact('monitorSeen', false)]
      if (player !== undefined) orders.push(move(player.x, player.z))
      if (setup.items !== undefined) orders.push(items(setup.items))
      for (const name of Object.keys(setup.facts ?? {}).sort())
        orders.push(fact(name, setup.facts?.[name] as never))
      return orders
    },
    view(sim: Sim, time: number): BotView {
      const at = (sid: number): Point => {
        const { x, z } = (sim.entity(sid) as NonNullable<ReturnType<Sim['entity']>>).get(InSector)
        return { x, z }
      }
      const state = sim.resource(SystemsState)
      const puzzle = sim.resource(PuzzleState)
      return {
        time,
        dt: 1 / sim.tickHz,
        player: at(PLAYER),
        walking: sim.resource(NavRoutes)[String(PLAYER)] !== undefined,
        lit: false,
        agents: Object.keys(state.agents)
          .sort()
          .map((id) => ({ id, mode: state.agents[id]?.mode ?? '', ...at(state.agents[id]?.sid ?? 0) })),
        hotspots: WARD_PUZZLE.hotspots,
        items: puzzle.items,
        facts: puzzle.facts,
      }
    },
    retune: (name, value) => {
      if (name !== 'watchmanHunt') throw new Error(`ward: no tunable ${name}`)
      const next = structuredClone(def) as SystemsDef & { agents: { speed: Record<string, number> }[] }
      ;(next.agents[0] as { speed: Record<string, number> }).speed.hunt = value
      return wardScene(next)
    },
  }
  return { ...scene, routes: [{ name: 'key', plan: stepsFor(scene, ['desk.key', 'exit.open']) }] }
}
