import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import type { Places } from '@automata/places'
import {
  createSim,
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type SimContext,
} from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Level2dAt, level2dLintFloor, level2dPlaces, level2dPlugin } from '#src/entries/sim.ts'

// A small level, 16 px to the metre: 8 cells across and 4 down, a floor of solid cells on the bottom row, a block in the
// middle of the row above, and three areas the way the editor saves them (a rectangle placed by its top-left pivot).
const PROJECT: ContentProject = {
  format: 'af2d-content',
  version: 1,
  name: 'Test',
  template: 'blank',
  layers: [
    {
      id: 'collision',
      kind: 'intgrid',
      grid: 16,
      values: [
        { value: 1, id: 'solid' },
        { value: 2, id: 'water' },
      ],
    },
    { id: 'entities', kind: 'entities', grid: 16, snap: true },
  ],
  tilesets: [],
  entities: [
    {
      id: 'area',
      fields: [],
      shape: 'rect',
      size: { w: 16, h: 16 },
      pivot: { x: 0, y: 0 },
      resizable: 'xy',
      tags: ['area'],
    },
    {
      id: 'crate',
      fields: [],
      shape: 'rect',
      size: { w: 16, h: 16 },
      pivot: { x: 0, y: 0 },
      resizable: 'none',
      tags: [],
    },
  ],
  levelFields: [],
}
const area = (id: string, x: number, y: number, w: number, h: number, fields = {}) => ({
  id,
  def: 'area',
  x,
  y,
  w,
  h,
  fields,
})
const LEVEL: ContentLevel = {
  format: 'af2d-content',
  version: 1,
  id: 'small',
  name: 'Small',
  size: { w: 128, h: 64 },
  background: { color: '#000000', mode: 'fit' },
  fields: {},
  layers: [
    {
      def: 'collision',
      kind: 'intgrid',
      rows: ['. . . . . . . .', '. . . 1 . . . .', '. . . . . . . .', '1*8'],
    },
    {
      def: 'entities',
      kind: 'entities',
      items: [
        area('a1', 0, 0, 64, 64, { name: 'hall', zone: 'inside' }),
        area('a2', 64, 0, 64, 64, { name: 'yard', zone: 'outside' }),
        area('a3', 32, 0, 64, 32),
        { id: 'c1', def: 'crate', x: 16, y: 16, fields: {} },
      ],
    },
  ],
}

const Walker = defineComponent('test.walker', { px: 'f32', py: 'f32', hp: 'i32' })
const Ask = defineCommand('test.ask', z.object({}))
const ctxless = undefined as never
const make = (): Places => level2dPlaces({ level: LEVEL, project: PROJECT })

/** Runs `ask` once inside a step of a sim that has the walker component and the extension's own position. */
async function inSim<T>(ask: (ctx: SimContext) => T): Promise<T> {
  let answer: T | undefined
  const sim = await createSim({
    seed: 1,
    plugins: [
      level2dPlugin,
      definePlugin({
        name: 'test',
        components: [Walker],
        commands: [Ask],
        systems: [
          defineSystem('test.ask', 'gameplay', (ctx) => {
            for (const _ of ctx.commands.of(Ask)) answer = ask(ctx)
          }),
        ],
      }),
    ],
  })
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type: Ask.id, payload: {} }])
  sim.dispose()
  return answer as T
}

describe('level2dPlaces: rooms', () => {
  it('reads areas in file order: name or id, zone or id, and the first wins where they overlap', () => {
    const places = make()
    expect(places.provider).toBe('level-2d')
    expect(places.rooms(ctxless)).toEqual([
      { id: 'hall', zone: 'inside' },
      { id: 'yard', zone: 'outside' },
      { id: 'a3', zone: 'a3' },
    ])
    // 16 px to the metre: (1, 1) is in hall; (5, 1) is in yard; (3, 1) is in hall and a3, and hall is first.
    expect(places.roomAt(ctxless, { x: 1, z: 1 })).toBe(1)
    expect(places.roomAt(ctxless, { x: 5, z: 1 })).toBe(2)
    expect(places.roomAt(ctxless, { x: 3, z: 1 })).toBe(1)
    expect(places.roomAt(ctxless, { x: 7, z: 5 })).toBe(0)
  })

  it('gives a point on a shared edge to the first area', () => {
    const places = make()
    expect(places.roomAt(ctxless, { x: 4, z: 1 })).toBe(1)
  })
})

describe('level2dPlaces: crossing', () => {
  it('is the shared edge’s middle, with a point THROUGH metres inside the far area', () => {
    const places = make()
    expect(places.crossing(ctxless, 'hall', 'yard')).toEqual({ x: 4, z: 2, into: { x: 4.5, z: 2 } })
    expect(places.crossing(ctxless, 'yard', 'hall')).toEqual({ x: 4, z: 2, into: { x: 3.5, z: 2 } })
  })

  it('is null for areas that only meet at a corner, overlap, or do not exist', () => {
    const project = PROJECT
    const level: ContentLevel = {
      ...LEVEL,
      layers: [
        LEVEL.layers[0] as ContentLevel['layers'][number],
        {
          def: 'entities',
          kind: 'entities',
          items: [area('p', 0, 0, 32, 32), area('q', 32, 32, 32, 32), area('r', 16, 16, 32, 32)],
        },
      ],
    }
    const places = level2dPlaces({ level, project })
    expect(places.crossing(ctxless, 'p', 'q')).toBeNull()
    expect(places.crossing(ctxless, 'p', 'r')).toBeNull()
    expect(places.crossing(ctxless, 'p', 'nope')).toBeNull()
  })
})

describe('level2dPlaces: walls', () => {
  it('blocks walking and sight through solid cells, and not through water', () => {
    const places = make()
    const walk = places.walk(ctxless, {})
    const sight = places.sight(ctxless, {})
    // The floor is row 3 (z 3..4 m); the block is column 3, row 1.
    expect(walk.segment({ x: 0.5, z: 3.5 }, { x: 1.5, z: 3.5 }, 0)).toBe(true)
    expect(sight.segment({ x: 0.5, z: 1.5 }, { x: 6.5, z: 1.5 }, 0)).toBe(true)
    expect(walk.segment({ x: 0.5, z: 0.5 }, { x: 6.5, z: 0.5 }, 0)).toBe(false)
    expect(walk.open('gate')).toBe(false)
    expect(places.walk(ctxless, { gate: true }).open('gate')).toBe(true)
  })

  it('counts the values it is told are solid', () => {
    const places = level2dPlaces({ level: LEVEL, project: PROJECT, solid: [2] })
    expect(places.walk(ctxless, {}).segment({ x: 0.5, z: 3.5 }, { x: 1.5, z: 3.5 }, 0)).toBe(false)
  })

  it('says so when the walls layer has no value called solid and none is given', () => {
    const project: ContentProject = {
      ...PROJECT,
      layers: [
        { id: 'collision', kind: 'intgrid', grid: 16, values: [{ value: 1, id: 'water' }] },
        PROJECT.layers[1] as ContentProject['layers'][number],
      ],
    }
    expect(() => level2dPlaces({ level: LEVEL, project })).toThrow(
      'The "collision" layer has no value called "solid"',
    )
  })
})

describe('level2dPlaces: positions', () => {
  it('reads and writes the game’s own component in pixels, as metres on the plan, and keeps its other fields', async () => {
    const places = level2dPlaces({
      level: LEVEL,
      project: PROJECT,
      position: { component: Walker, x: 'px', y: 'py' },
    })
    const result = await inSim((ctx) => {
      const sid = ctx.spawn(...places.spawnAt({ x: 4, z: 2 }))
      ctx.entity(sid)?.set(Walker, { hp: 7 })
      const spawned = { ...ctx.entity(sid)?.get(Walker) }
      const at = places.at(ctx, sid)
      places.move(ctx, sid, { x: 5, z: 2 })
      return { spawned, at, moved: { ...ctx.entity(sid)?.get(Walker) }, room: places.roomOf(ctx, sid) }
    })
    expect(result.spawned).toEqual({ px: 64, py: 32, hp: 7 })
    expect(result.at).toEqual({ x: 4, z: 2 })
    expect(result.moved).toEqual({ px: 80, py: 32, hp: 7 })
    // (5 m, 2 m) is in the yard, as soon as it has moved: a 2D room has no lag.
    expect(result.room).toBe(2)
  })

  it('uses the extension’s own level-2d.at when the game has no position component', async () => {
    const places = make()
    const result = await inSim((ctx) => {
      const sid = ctx.spawn(...places.spawnAt({ x: 1, z: 3 }))
      const stranger = ctx.spawn([Walker, { px: 1, py: 1 }])
      return {
        at: places.at(ctx, sid),
        none: places.at(ctx, stranger),
        pixels: { ...ctx.entity(sid)?.get(Level2dAt) },
        noRoom: places.roomOf(ctx, stranger),
      }
    })
    expect(result.at).toEqual({ x: 1, z: 3 })
    expect(result.none).toBeUndefined()
    expect(result.pixels).toEqual({ x: 16, y: 48 })
    expect(result.noRoom).toBe(0)
  })

  it('measures a metre as the walls grid by default and as `metre` when given', async () => {
    const places = level2dPlaces({ level: LEVEL, project: PROJECT, metre: 32 })
    const result = await inSim((ctx) => {
      const sid = ctx.spawn(...places.spawnAt({ x: 1, z: 1 }))
      return { ...ctx.entity(sid)?.get(Level2dAt) }
    })
    expect(result).toEqual({ x: 32, y: 32 })
  })
})

describe('level2dLintFloor', () => {
  // The same areas and walls as the places, for the cutscene lint, which has no sim to ask.
  const floor = level2dLintFloor({ level: LEVEL, project: PROJECT })

  it('says which area a point in metres is in, or none off every area', () => {
    expect(floor.sectorAt({ x: 1, z: 1 })).toBe('hall')
    expect(floor.sectorAt({ x: 5, z: 1 })).toBe('yard')
    expect(floor.sectorAt({ x: 7, z: 5 })).toBeUndefined()
  })

  it('is blocked by the solid cells, with the margin a body needs', () => {
    // The block is cell (3, 1): metres 3 to 4 across, 1 to 2 down.
    expect(floor.segmentBlocked({ x: 0.5, z: 1.5 }, { x: 3.5, z: 1.5 }, 0)).toBe(true)
    expect(floor.segmentBlocked({ x: 0.5, z: 0.5 }, { x: 2.5, z: 0.5 }, 0)).toBe(false)
    expect(floor.segmentBlocked({ x: 2.9, z: 1.5 }, { x: 2.9, z: 1.5 }, 0.2)).toBe(true)
  })

  it('treats the whole plane as floor in a level with no areas, since nothing says where it is', () => {
    const bare = level2dLintFloor({
      level: { ...LEVEL, layers: LEVEL.layers.filter((layer) => layer.kind !== 'entities') },
      project: PROJECT,
    })
    expect(bare.sectorAt({ x: 7, z: 5 })).toBeDefined()
  })
})
