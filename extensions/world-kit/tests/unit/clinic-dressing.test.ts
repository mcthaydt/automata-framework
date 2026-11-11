// The clinic's dressing (`spikes/clinic/dressing.ts`, written into the level by the converter): the world kit's clinic pieces
// placed where the source game's `dressClinic` put them. The level and its library are the converter's output; this test
// reads them as a game would, with the kit's generators registered, and holds the dressing to what it says it is.
import { readFileSync } from 'node:fs'
import type { WorldPiece } from '@automata/3d'
import { readLevel } from '@automata/3d/level'
import { buildWorld, type WorldLibrary } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const root = new URL('../../../../', import.meta.url)
const json = (path: string): any => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const clinic = json('spikes/clinic/content/clinic.af-sector.json')
const library: WorldLibrary = json('spikes/clinic/content/clinic.library.json')

const dress: { id: string; use: string; at: number[]; angle?: number }[] = clinic.props.filter(
  (p: { id: string }) => p.id.startsWith('dress-'),
)
const built = buildWorld(readLevel(clinic).level, library, { night: true })
const piecesOf = (id: string): WorldPiece[] =>
  built.pieces.filter((p) => p.id.split(':')[2]?.startsWith(`${id}.`))
const bounds = (pieces: readonly WorldPiece[]) => {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const { mesh } of pieces)
    for (let i = 0; i < mesh.positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k] as number, mesh.positions[i + k] as number)
        hi[k] = Math.max(hi[k] as number, mesh.positions[i + k] as number)
      }
  return { lo: lo as number[], hi: hi as number[] }
}
const byUse = (use: string) => dress.filter((p) => p.use === use)

describe('the clinic dressing', () => {
  it('places each of the twelve kit pieces the source dresses the clinic with', () => {
    const wanted: Record<string, number> = {
      'moon-shaft': 2,
      'light-pool': 4,
      puddle: 1,
      'pipe-run': 10,
      grime: 7,
      screen: 1,
      plaque: 6,
      curtain: 2,
      shelving: 3,
      'ceiling-tile': 1,
      cable: 2,
      'wall-notice': 5,
    }
    for (const [use, least] of Object.entries(wanted))
      expect(byUse(use).length, use).toBeGreaterThanOrEqual(least)
  })

  it('builds with nothing wrong, and every placed prop draws something', () => {
    expect(built.problems).toEqual([])
    for (const prop of dress) expect(piecesOf(prop.id).length, prop.id).toBeGreaterThan(0)
  })

  it('names only presets its own library carries, and they are the kit’s presets as they are', () => {
    for (const prop of dress) {
      expect(library.props?.[prop.use], prop.use).toBeDefined()
      expect(library.props?.[prop.use], prop.use).toEqual(worldKitLibrary.props?.[prop.use])
    }
  })

  it('keeps every part inside the building, none poking out of a wall', () => {
    for (const prop of dress) {
      const { lo, hi } = bounds(piecesOf(prop.id))
      expect(lo[0], prop.id).toBeGreaterThan(-5.2)
      expect(hi[0], prop.id).toBeLessThan(5.2)
      expect(lo[2], prop.id).toBeGreaterThan(-7.1)
      expect(hi[2], prop.id).toBeLessThan(7.1)
    }
  })

  it('hangs a notice on the noticeboard wall, facing into the room', () => {
    const wall = byUse('wall-notice').find((p) => p.id === 'dress-notice-board-1')
    expect(wall, 'the first notice on the board').toBeDefined()
    const { lo, hi } = bounds(piecesOf((wall as { id: string }).id))
    // The north-east wall is at z -0.875, the room to its south (+z): the sheet stands just off the wall, on its room side.
    expect(lo[2]).toBeGreaterThan(-0.875)
    expect(hi[2]).toBeLessThan(-0.75)
    expect(hi[1]).toBeGreaterThan(1.5)
  })

  it('hangs the east wall’s poster off the wall, facing west into the hall', () => {
    const poster = dress.find((p) => p.id === 'dress-poster-east-1')
    expect(poster, 'the east wall poster').toBeDefined()
    const { lo, hi } = bounds(piecesOf((poster as { id: string }).id))
    expect(hi[0]).toBeLessThan(4.875)
    expect(lo[0]).toBeGreaterThan(4.7)
  })

  it('lays the moon shaft from the ward’s high window down to the hall floor', () => {
    const shaft = dress.find((p) => p.id === 'dress-moon-ward')
    expect(shaft, 'the ward window’s shaft').toBeDefined()
    const { lo, hi } = bounds(piecesOf((shaft as { id: string }).id))
    expect(hi[1]).toBeCloseTo(3.75, 1)
    expect(lo[1]).toBeLessThan(0.05)
    // From the window in the ward-back wall (z -3.8) across the hall’s north (-0.875) to the floor by the desk (z 1.2).
    expect(lo[2]).toBeLessThan(-3.7)
    expect(hi[2]).toBeGreaterThan(1)
  })

  it('hangs the west wall’s frame off the wall, facing east, and the east curtain along its rail', () => {
    const frame = bounds(piecesOf('dress-frame-west-1'))
    expect(frame.lo[0] as number).toBeGreaterThan(-4.875)
    expect(frame.hi[0] as number).toBeLessThan(-4.7)
    // The east curtain is 1.1 m wide on a rail that runs north to south at x -2.35: its width is along z, its depth across x.
    const curtain = bounds(piecesOf('dress-curtain-east'))
    expect((curtain.hi[2] as number) - (curtain.lo[2] as number)).toBeGreaterThan(1)
    expect((curtain.hi[0] as number) - (curtain.lo[0] as number)).toBeLessThan(0.6)
  })
})
