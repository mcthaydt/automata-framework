// A small 2D level with a guard in it, for the tests that show the systems extension works on a flat level and for the
// parity run that shows it works the same in every engine. The level is 12 cells by 6 at 16 px a cell (one metre a cell):
// a Hall on the left, a Yard on the right, a wall one cell thick between them with a two-cell gap, and a guard who patrols
// the Hall, hunts what he sees, and follows through the gap.
import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import { createNavPlugin, loadNavGraph, type NavGraph } from '@automata/nav/sim'
import { createPuzzlePlugin } from '@automata/puzzle/sim'
import {
  canonicalJson,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type SimEvent,
} from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import {
  type AgentDef,
  createSystems,
  type SystemsDef,
  SystemsEnv,
  SystemsState,
} from '@automata/systems/sim'
import { z } from 'zod'
import { Level2dAt, level2dPlaces, level2dPlugin } from '../entries/sim.ts'

/** Pixels in a cell, which is a metre. */
export const CELL = 16

const PROJECT: ContentProject = {
  format: 'af2d-content',
  version: 1,
  name: 'Patrol',
  template: 'blank',
  layers: [
    { id: 'collision', kind: 'intgrid', grid: CELL, values: [{ value: 1, id: 'solid' }] },
    { id: 'entities', kind: 'entities', grid: CELL, snap: true },
  ],
  tilesets: [],
  entities: [
    {
      id: 'area',
      fields: [],
      shape: 'rect',
      size: { w: CELL, h: CELL },
      pivot: { x: 0, y: 0 },
      resizable: 'xy',
      tags: ['area'],
    },
  ],
  levelFields: [],
}
const area = (id: string, x: number, name: string) => ({
  id,
  def: 'area',
  x,
  y: 0,
  w: 6 * CELL,
  h: 6 * CELL,
  fields: { name },
})
const LEVEL: ContentLevel = {
  format: 'af2d-content',
  version: 1,
  id: 'patrol',
  name: 'Patrol',
  size: { w: 12 * CELL, h: 6 * CELL },
  background: { color: '#000000', mode: 'fit' },
  fields: {},
  layers: [
    // The wall is column 6 (the Yard's first), solid on rows 0, 1, 4 and 5: rows 2 and 3 are the gap.
    {
      def: 'collision',
      kind: 'intgrid',
      rows: ['.*6 1 .*5', '.*6 1 .*5', '.*12', '.*12', '.*6 1 .*5', '.*6 1 .*5'],
    },
    {
      def: 'entities',
      kind: 'entities',
      items: [area('hall', 0, 'hall'), area('yard', 6 * CELL, 'yard')],
    },
  ],
}

const GRAPH: NavGraph = {
  nodes: {
    hallW: { x: 2, z: 3 },
    hallE: { x: 5, z: 3 },
    gate: { x: 6, z: 3 },
    yardW: { x: 7, z: 3 },
    yardE: { x: 10, z: 3 },
  },
  edges: [
    ['hallW', 'hallE'],
    ['hallE', 'gate'],
    ['gate', 'yardW'],
    ['yardW', 'yardE'],
  ],
}

/** Walks between two stops in the Hall, hunts what it sees, follows the player through the gap, and gives up after a while. */
const GUARD: AgentDef = {
  id: 'guard',
  modes: ['patrol', 'hunt', 'follow'],
  initial: 'patrol',
  speed: { patrol: 1, hunt: 2, follow: 2 },
  senses: [{ sight: { range: 4.5, wallsOnly: true } }, { touch: { radius: 0.5 } }],
  transitions: [
    {
      from: 'hunt',
      to: 'follow',
      when: [{ crossed: true }],
      priority: 90,
      do: [{ followThrough: { portal: 'crossed', delay: 0.5, then: 'hunt' } }],
    },
    { from: '*', to: 'hunt', when: [{ sees: true }], priority: 70, do: [{ goTo: 'player' }] },
    {
      from: 'hunt',
      to: 'patrol',
      when: [{ fact: 'self.idle', is: true }, { not: { sees: true } }, { timer: 3 }],
      priority: 30,
      do: [{ set: 'self.timer', to: 0 }],
    },
  ],
  routine: [
    { node: 'hallW', dwell: 0.5 },
    { node: 'hallE', dwell: 0.5 },
  ],
}

const SCENE: SystemsDef = {
  scene: 'patrol',
  objects: [],
  fairness: {
    cautiousWin: 0.9,
    firstThreatAfter: 20,
    telegraph: 1.5,
    maxDeathsPerRun: 1,
    safeWindowMargin: 1.3,
  },
  matrix: [],
  tunables: {},
  rules: [],
  agents: [GUARD],
  scenarios: [],
}

const point = z.strictObject({ x: z.number(), z: z.number() })
const Load = defineCommand('patrol2d.load', z.strictObject({ guard: point }))
const MakeNoise = defineCommand(
  'patrol2d.noise',
  z.strictObject({ at: point, loudness: z.number(), kind: z.string() }),
)
/** Puts the player at a point, in pixels: the game's own position, as an input system would write it. */
const Put = defineCommand('patrol2d.put', z.strictObject({ x: z.number(), y: z.number() }))

export interface Patrol2d {
  readonly sim: Sim
  /** Runs `seconds` of steps, the player standing where `putPlayer` or `walkPlayerTo` last left them; every event. */
  run(seconds: number): readonly SimEvent[]
  /** The player at a point in metres. */
  putPlayer(x: number, z: number): void
  /** The player walks to a point in metres at three metres a second, one step at a time. */
  walkPlayerTo(x: number, z: number): void
  /** A noise made at a point in metres, heard by whoever's ears reach it. */
  makeNoise(x: number, z: number, loudness: number, kind?: string): void
  /** The mode and the position in pixels of the guard, or of another character by name. */
  mode(id?: string): string
  guardPx(id?: string): { x: number; y: number }
  /** The area ('hall', 'yard') a body is in. */
  areaOf(who: 'player' | 'guard'): string | undefined
  /** One step with the player where they stand; the events it made. */
  tick(): readonly SimEvent[]
}

/** Who else is in the level, and who the guard is, for the tests of the ready-made characters. */
export interface Patrol2dCast {
  /** Stands in for the guard (the one the helpers answer for). */
  readonly agent?: AgentDef
  /** Lets `makeNoise` work (it adds a command to the sim, so the golden run leaves it out). */
  readonly noises?: boolean
  /** More characters, each at a point in metres. */
  readonly others?: readonly { readonly def: AgentDef; readonly at: { x: number; z: number } }[]
}

/** A sim of the level with the guard at `guardAt` (metres), default his first stop. */
export async function createPatrol2d(
  guardAt?: { x: number; z: number },
  cast: Patrol2dCast = {},
): Promise<Patrol2d> {
  const lead = cast.agent ?? GUARD
  const others = cast.others ?? []
  const scene: SystemsDef = { ...SCENE, agents: [lead, ...others.map((o) => o.def)] }
  const places = level2dPlaces({ level: LEVEL, project: PROJECT })
  // Where everyone stands; the load command carries only the lead's, as it always did (its shape is in the hash).
  const stands: Record<string, { x: number; z: number }> = {
    [lead.id]: guardAt ?? { x: 2, z: 3 },
    ...Object.fromEntries(others.map((o) => [o.def.id, o.at])),
  }
  const systems = createSystems({ places })
  const driver = definePlugin({
    name: 'patrol2d',
    dependsOn: ['level-2d', 'nav', 'puzzle', 'systems'],
    // The noise command is registered only when a test asks for it: a registered command is part of the sim's hash,
    // and the golden run's hash is committed.
    commands: cast.noises === true ? [Load, Put, MakeNoise] : [Load, Put],
    systems: [
      defineSystem('patrol2d.drive', 'input', (ctx) => {
        for (const { payload } of ctx.commands.of(Load)) {
          loadNavGraph(ctx, GRAPH)
          systems.load(ctx, scene, { [lead.id]: payload.guard, ...stands })
        }
        if (cast.noises === true)
          for (const { payload } of ctx.commands.of(MakeNoise)) systems.hear(ctx, payload)
        const player = ctx.resource(SystemsEnv).player
        for (const { payload } of ctx.commands.of(Put)) ctx.entity(player)?.set(Level2dAt, payload)
      }),
    ],
  })
  const sim = await createSim({
    seed: 2026,
    plugins: [level2dPlugin, createNavPlugin({ places }), createPuzzlePlugin(), systems.plugin, driver],
  })
  const player = sim.spawn([[Level2dAt, { x: 9.5 * CELL, y: 5.5 * CELL }]])
  sim.resource(SystemsEnv).player = player
  const step = (...orders: { type: string; payload: unknown }[]): readonly SimEvent[] =>
    sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order }))).events
  const put = (x: number, z: number) => ({ type: Put.id, payload: { x: x * CELL, y: z * CELL } })
  let at = { x: 9.5, z: 5.5 }
  step({ type: Load.id, payload: { guard: stands[lead.id] as { x: number; z: number } } }, put(at.x, at.z))
  const guard = (id = lead.id) => sim.resource(SystemsState).agents[id] as { sid: number; mode: string }
  const tick = (): readonly SimEvent[] => step(put(at.x, at.z))
  const steps = (seconds: number): number => Math.round(seconds * sim.tickHz)
  const areaAt = (x: number): string | undefined =>
    x < 6 * CELL ? 'hall' : x <= 12 * CELL ? 'yard' : undefined
  const px = (sid: number) => {
    const here = sim.entity(sid)?.get(Level2dAt) as { x: number; y: number }
    return { x: here.x, y: here.y }
  }
  const walkTo = (x: number, z: number): void => {
    const from = at
    const count = Math.ceil(Math.hypot(x - from.x, z - from.z) / (3 / sim.tickHz))
    for (let i = 1; i <= count; i++) {
      at = { x: from.x + ((x - from.x) * i) / count, z: from.z + ((z - from.z) * i) / count }
      tick()
    }
  }
  return {
    sim,
    run: (seconds) => {
      const events: SimEvent[] = []
      for (let i = 0; i < steps(seconds); i++) events.push(...tick())
      return events
    },
    makeNoise: (x, z, loudness, kind = 'bottle') => {
      step({ type: MakeNoise.id, payload: { at: { x, z }, loudness, kind } }, put(at.x, at.z))
    },
    putPlayer: (x, z) => {
      at = { x, z }
    },
    walkPlayerTo: walkTo,
    mode: (id) => guard(id).mode,
    guardPx: (id) => px(guard(id).sid),
    // A point's area is read through the places, as the sim does, not copied from the picture.
    areaOf: (who) => {
      const here = px(who === 'player' ? player : guard().sid)
      const room = places.rooms(sim as never)[
        places.roomAt(sim as never, { x: here.x / CELL, z: here.y / CELL }) - 1
      ]
      return room?.id ?? areaAt(here.x)
    },
    tick,
  }
}

/** What a golden run reports, the same in every engine. */
export interface Patrol2dRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
  /** The step the guard first hunts the player on, and the one he first follows through the gap on. */
  readonly hunts: number
  readonly follows: number
}

const TICKS = 600

/** Where the player is at `tick` in the script (metres): far away, then in the Hall in his sight, then through the gap. */
function playerAt(tick: number): { x: number; z: number } {
  if (tick < 60) return { x: 9.5, z: 5.5 }
  if (tick < 90) return { x: 4, z: 3 }
  const walked = ((tick - 90) * 3) / 60 // 3 m/s
  return { x: Math.min(9, 4 + walked), z: 3 }
}

/**
 * The scripted run: the player shows up in the guard's sight, then walks through the gap. 600 steps, whole or restored from a
 * snapshot into a new sim at `restoreAt`; the same hash either way, and in every engine.
 */
export async function runPatrol2dGolden(restoreAt?: number): Promise<Patrol2dRun> {
  let game = await createPatrol2d()
  const lines: string[] = []
  let hunts = -1
  let follows = -1
  while (game.sim.tick < TICKS) {
    if (game.sim.tick === restoreAt) {
      const bytes = game.sim.snapshot()
      game.sim.dispose()
      game = await createPatrol2d()
      game.sim.restore(bytes)
    }
    const tick = game.sim.tick
    const at = playerAt(tick)
    game.putPlayer(at.x, at.z)
    for (const event of game.tick()) {
      lines.push(canonicalJson(event))
      const to = (event.payload as { to?: string }).to
      if (event.type === 'systems.mode' && to === 'hunt' && hunts < 0) hunts = tick
      if (event.type === 'systems.mode' && to === 'follow' && follows < 0) follows = tick
    }
  }
  const run = {
    seed: game.sim.seed,
    ticks: game.sim.tick,
    hash: game.sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
    hunts,
    follows,
  }
  game.sim.dispose()
  return run
}
