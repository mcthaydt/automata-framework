// The extension's own small scene, so its tests stand without a game: a hall and a pantry in one `af-sector/2` level,
// the pantry behind a door, and the hotspots a person would tap: a `jar` in the hall, a `cupboard` to hide in, a `crate`
// behind the door and a `shelf` that is only usable once the door is open. The puzzle's words are message keys, as a
// game's are. Tests and tools only.
import { type AfSector2, readLevel } from '@automataframework/3d/level'
import {
  type Blocked,
  createNavPlugin,
  loadNavGraph,
  NavAgent,
  NavDoors,
  type NavGraph,
} from '@automataframework/nav/sim'
import {
  createPuzzlePlugin,
  loadPuzzle,
  type PuzzleDef,
  type PuzzleOptions,
  PuzzleSaid,
  PuzzleState,
} from '@automataframework/puzzle/sim'
import {
  blockedBy,
  InSector,
  loadSectorMap,
  readSectorMap,
  resolvedMap,
  sectorsPlugin,
} from '@automataframework/sectors/sim'
import {
  type Command,
  createSim,
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type EventDef,
  type Sim,
  type SimContext,
} from '@automataframework/sim'
import { z } from 'zod'
import type { Hotspot } from '../shared/sim/hotspot.schema'
import { hotspotsOf } from '../shared/sim/hotspots-of'
import { createInteract, type Interact } from '../shared/sim/interact.plugin'
import { useCommands } from '../shared/use-commands'

const room = (id: string, corners: unknown[]) => ({ id, zone: id, floor: 0, ceiling: 3, light: 1, corners })

/** The hall (x 0 to 4) and the pantry (x 4 to 8) share an open edge at x = 4; the door stands in it. */
const LEVEL = {
  format: 'af-sector/2',
  name: 'pantry',
  sectors: [
    room('hall', [
      [0, 0],
      [4, 0, { next: 'pantry' }],
      [4, 4],
      [0, 4],
    ]),
    room('pantry', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'hall' }],
    ]),
  ],
  entityDefs: [{ id: 'hotspot' }],
  entities: [
    { def: 'hotspot', id: 'jar', x: 3, z: 1, reach: 1.2, name: 'name.jar' },
    { def: 'hotspot', id: 'cupboard', x: 3, z: 3, reach: 1.2, name: 'name.cupboard', hide: true },
    { def: 'hotspot', id: 'crate', x: 7, z: 3, reach: 1.2, name: 'name.crate' },
    {
      def: 'hotspot',
      id: 'shelf',
      x: 6,
      z: 1,
      reach: 1.2,
      name: 'name.shelf',
      when: [{ fact: 'doorOpen', is: true }],
    },
  ],
}

const GRAPH: NavGraph = {
  nodes: { hall: { x: 3.5, z: 2 }, pantry: { x: 4.5, z: 2 } },
  edges: [['hall', 'pantry', 'pantryDoor']],
}

const PUZZLE: PuzzleDef = {
  scene: 'pantry',
  facts: { doorOpen: false },
  items: ['spoon', 'lid'],
  hotspots: { jar: { x: 3, z: 1 }, cupboard: { x: 3, z: 3 }, crate: { x: 7, z: 3 }, shelf: { x: 6, z: 1 } },
  entry: [{ name: 'start', items: ['spoon', 'lid'] }],
  actions: [
    { id: 'jar.spoon', at: 'jar', use: 'spoon', then: [], say: 'jarSpoon' },
    { id: 'jar', at: 'jar', then: [], say: 'jar' },
    { id: 'cupboard', at: 'cupboard', then: [], say: 'cupboard' },
    { id: 'crate', at: 'crate', then: [], say: 'crate' },
    { id: 'shelf', at: 'shelf', then: [], say: 'shelf' },
    { id: 'combined', at: 'combine', use: ['spoon', 'lid'], then: [], say: 'combined' },
    { id: 'code', at: 'code', when: [{ fact: 'code', is: '42' }], then: [], say: 'codeRight' },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'doorOpen', is: true }],
  fallback: { '*': 'nothing', code: 'wrong' },
}

/** The player: the one walker the game's `player` option points at. */
const Player = defineComponent('pantry.player', { tag: 'i32' })
const Load = defineCommand('pantry.load', z.strictObject({}))
const Door = defineCommand('pantry.door', z.strictObject({ open: z.boolean() }))

/** The door at x = 4 is the game's own obstacle: a line nothing crosses while it is shut. */
const blocked = (ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked => {
  const walls = blockedBy(resolvedMap(ctx), doors)
  return {
    open: walls.open,
    segment: (a, b, margin) =>
      walls.segment(a, b, margin) || (doors.pantryDoor !== true && (a.x - 4) * (b.x - 4) < 0),
  }
}

const level = (): AfSector2 => readLevel(LEVEL).level

export interface PantryOptions {
  /** Where the player starts; default the middle of the hall's west side. */
  readonly start?: { readonly x: number; readonly z: number }
  /** The puzzle options a game would give, if a test needs them. */
  readonly puzzle?: PuzzleOptions
}

export interface Pantry {
  readonly sim: Sim
  readonly interact: Interact
  /** The hotspots the level declares. */
  readonly hotspots: readonly Hotspot[]
  /** Every hiding place the interact system was told to hide at. */
  readonly hid: string[]
  /** Every event so far, as `{ type, payload }`, in order. */
  readonly log: { readonly type: string; readonly payload: unknown }[]
  /** Steps once with these commands. */
  send(commands: readonly Pick<Command, 'type' | 'payload'>[]): void
  /** Steps `n` times with none. */
  tick(n: number): void
  /** What a tap on `at` sends: the walk and the use, in one step. */
  use(at: string, held?: string): void
  /** The payloads of every event of a kind so far. */
  events(def: EventDef): unknown[]
  /** The lines the puzzle has said, in order. */
  said(): string[]
  player(): { readonly x: number; readonly z: number }
  inReach(): readonly Hotspot[]
  hash(): string
  dispose(): void
}

/** A sim of the pantry with interact, nav and puzzle running, loaded in one step. */
export async function createPantry(options: PantryOptions = {}): Promise<Pantry> {
  const hid: string[] = []
  const read = hotspotsOf(level())
  if (read.problems.length > 0) throw new Error(read.problems.join('; '))
  const puzzle = options.puzzle ?? {}
  const interact = createInteract({
    player: (ctx) => {
      const [entity] = ctx.query(Player)
      if (entity === undefined) return undefined
      const { x, z } = entity.get(InSector)
      return { entity: entity.sid, x, z }
    },
    reader: (ctx) => {
      const state = ctx.resource(PuzzleState)
      return { fact: (name) => state.facts[name], has: (item) => state.items.includes(item) }
    },
    hide: (_ctx, spot) => hid.push(spot),
    puzzle,
  })
  const game = definePlugin({
    name: 'pantry',
    dependsOn: ['sectors', 'nav', 'puzzle', 'interact'],
    components: [Player],
    commands: [Load, Door],
    systems: [
      defineSystem('pantry.input', 'input', (ctx) => {
        if (ctx.commands.of(Load).length > 0) {
          loadSectorMap(ctx, readSectorMap(LEVEL).level)
          loadNavGraph(ctx, GRAPH)
          loadPuzzle(ctx, PUZZLE, 'start')
          interact.load(ctx, read.hotspots)
        }
        for (const { payload } of ctx.commands.of(Door)) {
          const doors = ctx.resource(NavDoors)
          doors.open.pantryDoor = payload.open
          doors.version += 1
          ctx.resource(PuzzleState).facts.doorOpen = payload.open
        }
      }),
    ],
  })
  const sim = await createSim({
    seed: 2026,
    plugins: [sectorsPlugin, createNavPlugin({ blocked }), createPuzzlePlugin(puzzle), interact.plugin, game],
  })
  const start = options.start ?? { x: 1, z: 2 }
  const sid = sim.spawn([[InSector, start], [NavAgent, { speed: 3 }], Player])
  const log: Pantry['log'][number][] = []
  const send: Pantry['send'] = (commands) => {
    const result = sim.step(commands.map((c, seq) => ({ tick: sim.tick, source: 0, seq, ...c })))
    for (const e of result.events) log.push({ type: e.type, payload: e.payload })
  }
  send([{ type: Load.id, payload: {} }])
  log.length = 0
  const pantry: Pantry = {
    sim,
    interact,
    hotspots: read.hotspots,
    hid,
    log,
    send,
    tick: (n) => {
      for (let i = 0; i < n; i += 1) send([])
    },
    use: (at, held) => {
      const spot = read.hotspots.find((h) => h.id === at)
      if (spot === undefined) throw new Error(`the pantry has no hotspot "${at}"`)
      const [walk, use] = useCommands(sid, spot, held)
      send([
        { type: 'nav.walk-to', payload: walk },
        { type: 'interact.use', payload: use },
      ])
    },
    events: (def) => log.filter((e) => e.type === def.id).map((e) => e.payload),
    said: () => pantry.events(PuzzleSaid).map((e) => (e as { line: string }).line),
    player: () => {
      const { x, z } = (sim.entity(sid) as NonNullable<ReturnType<Sim['entity']>>).get(InSector)
      return { x, z }
    },
    inReach: () => interact.inReach(sim),
    hash: () => sim.hash(),
    dispose: () => sim.dispose(),
  }
  return pantry
}
