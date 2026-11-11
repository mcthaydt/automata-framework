// The converted clinic (`spikes/clinic`, from the source game by `convert.ts`): the level reads clean, holds everything the
// earlier conversion's fixture held, and builds with nothing wrong. A level that has gone stale against its fixture, or names a
// swatch, a lamp kind or a prop its library lacks, fails here.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import { readLevel } from '#src/shared/level/read-level.ts'

const root = new URL('../../../../../', import.meta.url)
const json = (path: string): any => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const clinic = json('spikes/clinic/content/clinic.af-sector.json')
const library: WorldLibrary = json('spikes/clinic/content/clinic.library.json')
const fixture = json('extensions/sectors/src/testing/fixtures/clinic.af-sector.json')

/** Whether `actual` holds every member `expected` has, to any depth. */
function holds(actual: unknown, expected: unknown, path = ''): string[] {
  if (expected === null || typeof expected !== 'object')
    return actual === expected
      ? []
      : [`${path}: ${JSON.stringify(actual)} is not ${JSON.stringify(expected)}`]
  if (Array.isArray(expected))
    return Array.isArray(actual) && actual.length === expected.length
      ? expected.flatMap((e, i) => holds(actual[i], e, `${path}[${i}]`))
      : [`${path}: not the ${expected.length} entries of the fixture`]
  return Object.entries(expected).flatMap(([key, value]) =>
    holds((actual as Record<string, unknown> | undefined)?.[key], value, `${path}.${key}`),
  )
}

describe('the converted clinic', () => {
  const read = readLevel(clinic)
  it('reads as an af-sector/2 level with nothing wrong', () => {
    expect(read.problems).toEqual([])
    expect(read.level.sectors.map((s) => s.id)).toEqual([
      'hall',
      'counter',
      'ward',
      'mouth',
      'corridor',
      'doorway',
      'closet',
    ])
  })
  it('holds every sector and mass of the fixture of the earlier conversion, member for member', () => {
    // Except the floors, which are the kit's tile floor now (the fixture names the flat `floor` and `floorDim`).
    const tiled = JSON.parse(JSON.stringify(fixture.sectors).replace(/:"floor(Dim)?"/g, ':"tileFloor"'))
    expect(holds(clinic.sectors, tiled)).toEqual([])
    expect(holds(clinic.masses, fixture.masses)).toEqual([])
  })
  it('carries the fifteen lamps, the four bounce points and the camera zones', () => {
    expect(clinic.lamps).toHaveLength(15)
    expect(clinic.lamps.find((l: { id: string }) => l.id === 'deskLamp')).toMatchObject({
      kind: 'desk',
      at: [3.05, 1.15, 1.55],
      radius: 1.7,
    })
    expect(clinic.bounce).toHaveLength(4)
    expect(Object.keys(clinic.views).sort()).toEqual([
      'closet',
      'corridor',
      'hall',
      'spot-corridor',
      'spot-hall',
      'spot-supply',
      'spot-ward',
    ])
    expect(read.level.sectors.find((s) => s.id === 'closet')?.view).toBe('closet')
  })
  it('builds with no lamp off its tone, no missing swatch and no missing model prop', () => {
    // The dressing and the fitted furniture are the world kit's pieces: core has no generator for them, and the kit's own tests
    // build them. What is left here is the stand-in boxes for models.
    const isModel = (p: { use?: string | undefined }) => p.use?.startsWith('model.') === true
    const models = (clinic.props as { use: string }[]).filter(isModel)
    const { problems, lamps, pieces } = buildWorld(
      { ...read.level, props: read.level.props?.filter(isModel) },
      library,
      { night: true },
    )
    expect(problems).toEqual([])
    expect(lamps).toHaveLength(15)
    expect(pieces.filter((p) => p.part === 'prop' && p.model !== undefined).length).toBe(models.length)
  })
  it('draws the reception counter: a kick, a front and a top on the step up to it', () => {
    const { pieces } = buildWorld(read.level, library, { night: true })
    const hall = pieces.filter((p) => p.sector === 'hall')
    for (const [role, surface] of [
      ['skirting', 'kick'],
      ['wainscot', 'counterFront'],
      ['rail', 'counterTop'],
    ] as const)
      expect(hall.some((p) => p.id.split(':')[1] === role && p.surface === surface)).toBe(true)
  })
  it("keeps each big surface at its texture's own palette step: the source has no gain to lift it", () => {
    // `mat(color, texture, 4.8)` in the source is the texture's repeat in metres, not a gain. A lifted floor and wall made the
    // walls neon under the room's lamps; the swatches' steps are the DUEL entries their textures are mostly made of.
    const step = (name: string) => (library.swatches[name] as { step: number }).step
    expect(step('plaster')).toBe(1)
    expect(step('wainscot')).toBe(5)
  })
  it("lays the kit's tile floor, a textured swatch, where the source has its floor tiles", () => {
    const floors = new Set(
      read.level.sectors.flatMap((sector) =>
        sector.floorTexture === undefined ? [] : [sector.floorTexture],
      ),
    )
    // The reception counter's top is its own surface; every room floor is the tile floor.
    expect([...floors].sort()).toEqual(['counterTop', 'tileFloor'])
    expect((library.swatches.tileFloor as { texture?: unknown }).texture).toMatchObject({
      photo: 'floorTiles',
    })
  })
})
