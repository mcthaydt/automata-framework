// The clinic's furniture (`spikes/clinic/furniture.ts`, written into the level by the converter): the kit's own bed, cabinets,
// seats, plants and stock in place of the grey boxes that stood for the source's models. Each is built by `fit` to the box the
// source's model filled, so the room keeps its masses; this test holds every one to that box, to its spot, and to the floor.
import { readFileSync } from 'node:fs'
import type { WorldPiece } from '@automata/3d'
import { readLevel } from '@automata/3d/level'
import { buildWorld, type WorldLibrary } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import '#src/features/props/register-props.ts'

const root = new URL('../../../../', import.meta.url)
const json = (path: string): any => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const clinic = json('spikes/clinic/content/clinic.af-sector.json')
const library: WorldLibrary = json('spikes/clinic/content/clinic.library.json')

interface Place {
  id: string
  use: string
  at: number[]
  angle: number
  with: { of?: string; size: number[]; turn?: number }
}
const props: Place[] = clinic.props.filter((p: { id: string }) => !p.id.startsWith('dress-'))
const fitted = props.filter((p) => p.use === 'fit')
const standIns = props.filter((p) => p.use.startsWith('model.'))
const built = buildWorld(readLevel(clinic).level, library, { night: true })
const piecesOf = (id: string): WorldPiece[] =>
  built.pieces.filter((p) => p.id.split(':')[2]?.startsWith(`${id}.`))
const bounds = (pieces: readonly WorldPiece[]) => {
  const lo = [Infinity, Infinity, Infinity] as number[]
  const hi = [-Infinity, -Infinity, -Infinity] as number[]
  for (const { mesh } of pieces)
    for (let i = 0; i < mesh.positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k] as number, mesh.positions[i + k] as number)
        hi[k] = Math.max(hi[k] as number, mesh.positions[i + k] as number)
      }
  return { lo, hi }
}

describe('the clinic furniture', () => {
  it('builds with nothing wrong', () => {
    expect(built.problems).toEqual([])
  })

  it('replaces every stand-in box with kit furniture', () => {
    expect(fitted.length).toBeGreaterThanOrEqual(57)
    for (const place of fitted) expect(piecesOf(place.id).length, place.id).toBeGreaterThan(0)
    expect(standIns.map((p) => p.id)).toEqual([])
  })

  it('draws the six wall fittings and two strip lights with the kit’s generators, and the fallen chair upright', () => {
    const of = (id: string) => (fitted.find((p) => p.id === id) as Place | undefined)?.with.of
    expect(of('trolley-1')).toBe('monitorCart')
    expect(of('wall-tv-1')).toBe('screen')
    expect(of('wall-sconce-1')).toBe('lamp')
    expect(of('junction-box-1')).toBe('utilityBox')
    expect(of('clock-1')).toBe('plaque')
    // A chair on its side is a turn about z, which `fit` does not have: the chair stands, in the box it would have lain in.
    expect(of('fallen-chair-1')).toBe('chair')
    expect(of('sink-1')).toBe('sink')
    expect(of('privacy-screen-1')).toBe('privacyScreen')
    expect(of('coat-hook-1')).toBe('coatHooks')
    expect(of('extinguisher-cabinet-1')).toBe('extinguisherCabinet')
    expect(of('strip-light-1')).toBe('stripLight')
    expect(of('strip-light-2')).toBe('stripLight')
  })

  it('fills the source’s box, centred on its spot, standing at its height', () => {
    for (const place of fitted) {
      const { lo, hi } = bounds(piecesOf(place.id))
      const [w, h, d] = place.with.size as [number, number, number]
      // The box's extent in the world after the turn: a quarter turn puts the prop's own x along the world's z, the privacy
      // screen's 23° turn is between.
      const turn = ((90 - place.angle) * Math.PI) / 180
      const [c, n] = [Math.abs(Math.cos(turn)), Math.abs(Math.sin(turn))]
      const [ex, ez] = [w * c + d * n, w * n + d * c]
      const [gx, gy, gz] = [0, 1, 2].map((k) => (hi[k] as number) - (lo[k] as number)) as [
        number,
        number,
        number,
      ]
      expect(gy, `${place.id} up`).toBeCloseTo(h, 2)
      if (n < 0.01 || c < 0.01) {
        expect(gx, `${place.id} x`).toBeCloseTo(ex, 2)
        expect(gz, `${place.id} z`).toBeCloseTo(ez, 2)
      } else {
        // Turned between: the world extent of a shape inside the box, which a zigzag need not fill at the corners.
        for (const [got, want, axis] of [
          [gx, ex, 'x'],
          [gz, ez, 'z'],
        ] as const) {
          expect(got, `${place.id} ${axis}`).toBeLessThanOrEqual(want + 0.005)
          expect(got, `${place.id} ${axis}`).toBeGreaterThan(want * 0.6)
        }
      }
      expect(((lo[0] as number) + (hi[0] as number)) / 2, `${place.id} at x`).toBeCloseTo(
        place.at[0] as number,
        2,
      )
      expect(((lo[2] as number) + (hi[2] as number)) / 2, `${place.id} at z`).toBeCloseTo(
        place.at[1] as number,
        2,
      )
      // On the floor, or on what it is put on (`at`'s third value), counter or shelf, no more than the 1.1 m counter above that.
      const base = (place.at[2] as number | undefined) ?? 0
      expect(lo[1] as number, `${place.id} base`).toBeGreaterThanOrEqual(base - 0.01)
      expect(lo[1] as number, `${place.id} base`).toBeLessThanOrEqual(base + 1.11)
    }
  })

  it('lies the bed along the ward’s alcove, its head toward the north wall', () => {
    const bed = fitted.find((p) => p.id === 'bed-1') as Place
    expect(bed.with.of).toBe('bed')
    const pillow = piecesOf('bed-1').find((p) => p.id.endsWith('.pillow')) as WorldPiece
    const { lo, hi } = bounds([pillow])
    expect(((lo[2] as number) + (hi[2] as number)) / 2).toBeLessThan(bed.at[1] as number)
  })
})
