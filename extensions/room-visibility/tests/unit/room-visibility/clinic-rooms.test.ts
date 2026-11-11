// The clinic (spikes/clinic/content, the converter's output) under room visibility: the level's own `visibility` policy
// agrees with its sectors, every piece the world builder makes has a room to draw in (a prop in the room it stands in,
// a mass in the rooms the policy gives it), and each wall's top goes with its wall when a zone cuts the wall away.
import { readFileSync } from 'node:fs'
import type { WorldPiece } from '@automata/3d'
import { insideSector, readLevel } from '@automata/3d/level'
import { buildWorld, type WorldLibrary } from '@automata/3d/props-kit'
import '@automata/world-kit'
import { describe, expect, it } from 'vitest'
import {
  checkRoomPolicy,
  createRoomVisibility,
  parseRoomPolicy,
  plansOf,
  wallGroupOfPiece,
  wallGroups,
} from '#src/entries/index.ts'

const root = new URL('../../../../../', import.meta.url)
const json = (path: string): any => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const clinic = json('spikes/clinic/content/clinic.af-sector.json')
const library: WorldLibrary = json('spikes/clinic/content/clinic.library.json')
const { level } = readLevel(clinic)
const policy = parseRoomPolicy(clinic.visibility)
const world = buildWorld(level, library, { night: true })
const roomOfSector = new Map(
  Object.entries(policy.rooms).flatMap(([room, ids]) => ids.map((id) => [id, room] as const)),
)
const roomOf = (piece: WorldPiece): string | undefined => roomOfSector.get(piece.sector)
const plans = plansOf(level)
const propOf = (piece: WorldPiece): string | undefined => /^[^:]+:prop:(.+?)\.\d+\./.exec(piece.id)?.[1]

describe('the clinic under room visibility', () => {
  it('has a policy that agrees with its sectors, zones and masses', () => {
    const facts = {
      sectors: clinic.sectors.map((s: { id: string }) => s.id),
      zones: ['hall', 'corridor', 'closet'],
      massCount: clinic.masses.length,
    }
    expect(checkRoomPolicy(policy, facts)).toEqual([])
  })

  it('builds with no problem, and every piece has a room to draw in', () => {
    expect(world.problems).toEqual([])
    expect(world.pieces.filter((p) => roomOf(p) === undefined).map((p) => p.id)).toEqual([])
  })

  describe('props are owned by the room they stand in', () => {
    const places: { id: string; at: number[] }[] = clinic.props
    const standingIn = (at: number[]): string | undefined =>
      plans.find((plan) => insideSector({ x: at[0] as number, z: at[1] as number }, plan))?.id
    // Pipe runs and wall plaques start in the thickness of a wall's return, which is in no sector: the builder gives them
    // the room of the nearest corner, which is the room of the wall they run along.
    const OFF_PLAN: Record<string, string> = {
      'dress-pipe-ne-low': 'reception',
      'dress-pipe-ne-high': 'reception',
    }

    it('puts every piece of a prop in one room: the room of the sector its place is in', () => {
      for (const place of places) {
        const pieces = world.pieces.filter((p) => propOf(p) === place.id)
        expect(pieces.length, place.id).toBeGreaterThan(0)
        const rooms = new Set(pieces.map(roomOf))
        expect(rooms.size, place.id).toBe(1)
        const sector = standingIn(place.at)
        const room = sector === undefined ? OFF_PLAN[place.id] : roomOfSector.get(sector)
        expect(room, `${place.id} stands in a room, or is listed as off the plan`).toBeDefined()
        expect([...rooms][0], place.id).toBe(room)
      }
    })

    it('keeps the hall’s dressing out of the corridor and the supply room', () => {
      // The player stands in the zone's own room: the corridor at (0, -3) and the supply room at (3, -4.2).
      const stands: Record<string, { x: number; z: number }> = {
        corridor: { x: 0, z: -3 },
        closet: { x: 3, z: -4.2 },
      }
      const seen = (zone: string): ReadonlySet<string> =>
        createRoomVisibility(policy, plans).update({
          zone,
          at: stands[zone] as { x: number; z: number },
          dt: 0,
          reducedMotion: true,
          cutscene: false,
        })
      for (const zone of ['corridor', 'closet']) {
        const shown = seen(zone)
        const drawn = world.pieces.filter(
          (p) => propOf(p)?.startsWith('dress-pipe-ne') && shown.has(roomOf(p) as string),
        )
        expect(
          drawn.map((p) => p.id),
          zone,
        ).toEqual([])
      }
    })
  })

  describe('a wall’s top is cut away with its wall', () => {
    const tops = world.pieces.filter((p) => p.id.includes(':top:'))
    const groups = wallGroups(level)

    it('is drawn for the walls that say so', () => {
      expect(tops.length).toBeGreaterThan(0)
    })

    it('belongs to the cutaway group of the wall it stands on, with that wall’s face', () => {
      for (const top of tops) {
        const group = wallGroupOfPiece(groups, top)
        expect(group, top.id).toBeDefined()
        const faces = world.pieces.filter(
          (p) =>
            p !== top &&
            p.part === 'wall' &&
            !p.id.includes(':top:') &&
            wallGroupOfPiece(groups, p)?.id === group?.id,
        )
        expect(faces.length, top.id).toBeGreaterThan(0)
      }
    })
  })
})
