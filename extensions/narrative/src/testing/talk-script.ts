// The narrative golden (M6 spec §4.9): the clinic's converted graphs, deck and canon in the talk game, played by a fixed
// script for 600 steps (conversations started, advanced and answered, the player walked through the rooms, bare-hand
// verbs at the deck's hotspots, the deck's system events), straight or restored from a snapshot.

import type { PuzzleDef } from '@mcthaydt/automata-puzzle/sim'
import { canonicalJson, type Sim } from '@mcthaydt/automata-sim'
import { hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { parse } from 'smol-toml'
import type { Canon, DialogueFile, NarrativeScene, StoryletsFile } from '../sim/index'
import canonToml from './fixtures/canon.toml?raw'
import dialogueToml from './fixtures/clinic.dialogue.toml?raw'
import storyletsToml from './fixtures/clinic.storylets.toml?raw'
import {
  advance,
  choose,
  createTalkGame,
  fact,
  load,
  move,
  type Order,
  SPOTS,
  start,
  step,
  system,
  verb,
} from './talk-game'

const SCENE: NarrativeScene = {
  canon: parse(canonToml) as unknown as Canon,
  graphs: (parse(dialogueToml) as unknown as DialogueFile).graphs,
  storylets: (parse(storyletsToml) as unknown as StoryletsFile).storylets,
}
const GRAPHS = SCENE.graphs.map((g) => g.id)
const EVENTS = ['fuel.low', 'grapple.nurse', 'barricade.set', 'barricade.open']
const HOTSPOTS = ['scrawl', 'wheelchair', 'bed']
const WALK = [SPOTS.hall, SPOTS.ward, SPOTS.hall, SPOTS.corridor, SPOTS.closet, SPOTS.corridor]

/** The deck's hotspots (the wheelchair's action says nothing, so its storylet plays at once), and a phone whose action starts the first graph through puzzle's `{ dialogue }` effect. */
const PUZZLE: PuzzleDef = {
  scene: 'clinic',
  facts: {},
  items: [],
  hotspots: {
    phone: { x: 0, z: 3 },
    scrawl: { x: -3, z: -2 },
    wheelchair: { x: 0, z: 5 },
    bed: { x: -4, z: -3 },
  },
  entry: [{ name: 'start', items: [] }],
  actions: [
    { id: 'phone', at: 'phone', then: [{ dialogue: GRAPHS[0] as string }], say: '' },
    { id: 'scrawl', at: 'scrawl', then: [], say: 'scrawl.own' },
    { id: 'wheelchair', at: 'wheelchair', then: [], say: '' },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'done', is: true }],
  fallback: { '*': 'nothing' },
}
const TICKS = 600

function ordersAt(tick: number): Order[] {
  if (tick === 0) return [load()]
  const orders: Order[] = []
  // The power comes on at step 200, so the deck's `enter` storylets can play from then on.
  if (tick === 200) orders.push(fact('power', true), fact('leaving', false))
  if (tick % 60 === 1)
    orders.push(move(WALK[Math.floor(tick / 60) % WALK.length] as { x: number; z: number }))
  if (tick % 120 === 2) orders.push(verb('phone'))
  else if (tick % 120 === 62) orders.push(start(GRAPHS[Math.floor(tick / 120) % GRAPHS.length] as string))
  if (tick % 10 === 5) orders.push(choose(Math.floor(tick / 10) % 3))
  else if (tick % 5 === 0) orders.push(advance())
  if (tick % 23 === 0) orders.push(verb(HOTSPOTS[Math.floor(tick / 23) % HOTSPOTS.length] as string))
  if (tick % 97 === 0) orders.push(system(EVENTS[Math.floor(tick / 97) % EVENTS.length] as string))
  return orders
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
  readonly storylets: number
}

export async function runNarrativeGolden(restoreAt?: number): Promise<GoldenRun> {
  let sim: Sim = (await createTalkGame(PUZZLE, SCENE)).sim
  const lines: string[] = []
  let storylets = 0
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = (await createTalkGame(PUZZLE, SCENE)).sim
      sim.restore(bytes)
    }
    for (const e of step(sim, ...ordersAt(sim.tick)).events) {
      lines.push(canonicalJson(e))
      if (e.type === 'narrative.storylet') storylets += 1
    }
  }
  const run = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
    storylets,
  }
  sim.dispose()
  return run
}
