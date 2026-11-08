import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { THROUGH } from '@automata/places'
import { createSim, defineCommand, definePlugin, defineSystem, type SimContext } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { blockedBy } from '#src/shared/sim/blocked.ts'
import { loadSectorMap } from '#src/shared/sim/load-sector-map.ts'
import { readSectorMap } from '#src/shared/sim/read-sector-map.ts'
import { resolvedMap } from '#src/shared/sim/resolved-map.ts'
import { InSector } from '#src/shared/sim/sectors.component.ts'
import { sectorsPlugin } from '#src/shared/sim/sectors.plugin.ts'
import { sectorsPlaces } from '#src/shared/sim/sectors-places.ts'
import { stepWith } from '#src/testing/step-with.ts'

// `sectorsPlaces`: the answers `narrative`, `nav` and `systems` read from the clinic's rooms today (`InSector`,
// `resolvedMap`, `blockedBy` and systems' own crossing maths), asked through the contract. It is the default for every
// consumer, so a 3D game must see exactly what it saw before.

const clinic = readSectorMap(
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../src/testing/fixtures/clinic.af-sector.json'), 'utf8'),
  ),
).level
const Go = defineCommand('probe.go', z.object({}))

/** Runs `ask` inside a step of a sim that has loaded the clinic. */
async function inClinic<T>(ask: (ctx: SimContext) => T): Promise<T> {
  let answer: T | undefined
  let load = true
  const sim = await createSim({
    seed: 1,
    plugins: [
      sectorsPlugin,
      definePlugin({
        name: 'probe',
        dependsOn: ['sectors'],
        commands: [Go],
        systems: [
          defineSystem('probe.go', 'gameplay', (ctx) => {
            if (load) {
              load = false
              loadSectorMap(ctx, clinic)
              ctx.spawn([InSector, { x: 1.5, z: 2.5, sector: 2 }])
            }
            for (const _ of ctx.commands.of(Go)) answer = ask(ctx)
          }),
        ],
      }),
    ],
  })
  stepWith(sim)
  stepWith(sim, [{ type: 'probe.go', payload: {} }])
  return answer as T
}

const POINTS = [
  { x: 0, z: 0 },
  { x: 1.5, z: 2.5 },
  { x: 3, z: 3 },
  { x: -4, z: 9 },
  { x: 12, z: 7 },
]

describe('sectorsPlaces', () => {
  it('is provided by sectors', () => {
    expect(sectorsPlaces.provider).toBe('sectors')
  })

  it('names the rooms and the room of a point as the resolved map does', async () => {
    const answers = await inClinic((ctx) => {
      const map = resolvedMap(ctx)
      return {
        rooms: sectorsPlaces.rooms(ctx),
        expectedRooms: map.sectors.map((s) => ({ id: s.id, zone: s.zone })),
        roomAt: POINTS.map((p) => sectorsPlaces.roomAt(ctx, p)),
        expectedAt: POINTS.map((p) => {
          const here = map.sectorAt(p)
          return here === undefined ? 0 : map.sectors.indexOf(here) + 1
        }),
      }
    })
    expect(answers.rooms.length).toBeGreaterThan(2)
    expect(answers.rooms).toEqual(answers.expectedRooms)
    expect(answers.roomAt).toEqual(answers.expectedAt)
    expect(answers.roomAt.some((room) => room > 0)).toBe(true)
  })

  it('reads and writes the walker`s InSector, spawns one there, and keeps the room as the last step decided it', async () => {
    const answers = await inClinic((ctx) => {
      const sid = ctx.query(InSector)[0]?.sid as number
      const before = sectorsPlaces.at(ctx, sid)
      const roomBefore = sectorsPlaces.roomOf(ctx, sid)
      // A point in another room: moving there changes `roomAt` of the position at once, not `roomOf` until the step ends.
      const elsewhere = POINTS.find((p) => {
        const room = sectorsPlaces.roomAt(ctx, p)
        return room > 0 && room !== roomBefore
      })
      sectorsPlaces.move(ctx, sid, elsewhere as { x: number; z: number })
      const spawned = ctx.spawn(...sectorsPlaces.spawnAt({ x: 4, z: 5 }))
      return {
        before,
        roomBefore,
        elsewhere,
        after: sectorsPlaces.at(ctx, sid),
        roomOfAfterMove: sectorsPlaces.roomOf(ctx, sid),
        roomAtAfterMove: sectorsPlaces.roomAt(ctx, elsewhere as { x: number; z: number }),
        spawned: sectorsPlaces.at(ctx, spawned),
        nobody: sectorsPlaces.at(ctx, 999),
        nobodyRoom: sectorsPlaces.roomOf(ctx, 999),
      }
    })
    expect(answers.before).toEqual({ x: 1.5, z: 2.5 })
    expect(answers.roomBefore).toBeGreaterThan(0)
    expect(answers.elsewhere).toBeDefined()
    expect(answers.after).toEqual(answers.elsewhere)
    expect(answers.roomOfAfterMove).toBe(answers.roomBefore)
    expect(answers.roomAtAfterMove).not.toBe(answers.roomBefore)
    expect(answers.spawned).toEqual({ x: 4, z: 5 })
    expect(answers.nobody).toBeUndefined()
    expect(answers.nobodyRoom).toBe(0)
  })

  it('walks and sees through the same walls and doors blockedBy gives', async () => {
    const answers = await inClinic((ctx) => {
      const map = resolvedMap(ctx)
      const doors = { lab: true, vault: false }
      const reference = blockedBy(map, doors)
      const walk = sectorsPlaces.walk(ctx, doors)
      const sight = sectorsPlaces.sight(ctx, doors)
      const pairs = POINTS.flatMap((a) => POINTS.map((b) => [a, b] as const))
      return {
        walk: pairs.map(([a, b]) => walk.segment(a, b, 0.2)),
        sight: pairs.map(([a, b]) => sight.segment(a, b, 0)),
        expectedWalk: pairs.map(([a, b]) => reference.segment(a, b, 0.2)),
        expectedSight: pairs.map(([a, b]) => reference.segment(a, b, 0)),
        doors: [walk.open('lab'), walk.open('vault'), sight.open('lab')],
      }
    })
    expect(answers.walk).toEqual(answers.expectedWalk)
    expect(answers.sight).toEqual(answers.expectedSight)
    expect(answers.walk.some(Boolean)).toBe(true)
    expect(answers.walk.some((blocked) => !blocked)).toBe(true)
    expect(answers.doors).toEqual([true, false, true])
  })

  it('gives the crossing systems always gave, for every pair of touching rooms', async () => {
    const answers = await inClinic((ctx) => {
      const map = resolvedMap(ctx)
      /** The edge between two sectors, as systems' `crossingOf` found it: the first portal edge from `from` into `to`. */
      const reference = (from: number, to: number) => {
        const source = map.sectors[from]
        for (const loop of source?.loops ?? [])
          for (const edge of loop) {
            if (edge.next !== to) continue
            const x = (edge.a.x + edge.b.x) / 2
            const z = (edge.a.z + edge.b.z) / 2
            return { x, z, into: { x: x - edge.normal.x * THROUGH, z: z - edge.normal.z * THROUGH } }
          }
        return null
      }
      const rooms = sectorsPlaces.rooms(ctx)
      const out: { pair: string; got: unknown; want: unknown }[] = []
      for (let from = 0; from < rooms.length; from++)
        for (let to = 0; to < rooms.length; to++)
          out.push({
            pair: `${rooms[from]?.id}>${rooms[to]?.id}`,
            got: sectorsPlaces.crossing(ctx, rooms[from]?.id as string, rooms[to]?.id as string),
            want: reference(from, to),
          })
      return out
    })
    expect(answers.length).toBeGreaterThan(4)
    for (const { pair, got, want } of answers) expect(got, pair).toEqual(want)
    expect(answers.some(({ got }) => got !== null)).toBe(true)
  })

  it('has no crossing for a room that is not there', async () => {
    expect(await inClinic((ctx) => sectorsPlaces.crossing(ctx, 'nowhere', 'nothing'))).toBeNull()
  })
})
