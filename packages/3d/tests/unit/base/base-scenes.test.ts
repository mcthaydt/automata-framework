// The base interior and exterior (`@automata/3d/base`): two plain places every look change is judged on. They build from
// core alone, name only what the base library has, and give the pieces the builder's maps gave (recorded from
// the base scenes through the world builder, before the trim's deletions).
import { describe, expect, it } from 'vitest'
import { BASE_PAIR, BASE_SCENES, baseLibrary } from '#src/entries/base.ts'
import { fovOf, LENS_MM } from '#src/features/camera/fov.ts'
import { cameraViewSchema } from '#src/features/camera/sim/camera-view.schema.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { registeredPropGenerators } from '#src/features/world/props/prop-generator-registry.ts'
import { afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'
import builder from '../../fixtures/base-scenes-builder.json' with { type: 'json' }

const names = ['base-interior', 'base-exterior'] as const

describe('the base scenes', () => {
  for (const name of names) {
    const level = BASE_SCENES[name]
    it(`${name} is a valid af-sector/2 level that builds with no problem from core alone`, () => {
      expect(afSector2Schema.safeParse(level).success).toBe(true)
      const world = buildWorld(level, baseLibrary)
      expect(world.problems).toEqual([])
      expect(world.pieces.length).toBeGreaterThan(20)
    })
    it(`${name} gives the pieces the builder's map gave: the same ids, swatches and meshes' sizes`, () => {
      // The fixture is the builder's own cut; the light's finer cut (`seg`) is `build.test.ts`'s.
      const world = buildWorld(level, baseLibrary, { seg: 0 })
      const recorded = builder[name]
      const got = world.pieces.map((p) => ({
        id: p.id,
        surface: p.surface,
        vertices: p.mesh.positions.length / 3,
        indices: p.mesh.indices.length,
      }))
      // Core's box names its part `body`; the builder's generic box called it `block`.
      expect(got).toEqual(recorded.pieces.map((p) => ({ ...p, id: p.id.replace(/\.block$/, '.body') })))
      expect(world.lamps.map((l) => ({ kind: l.kind, at: l.at }))).toEqual(
        recorded.lamps.map((l) => ({ kind: l.kind, at: l.at })),
      )
    })
  }
  it('the interior is lit at lamplight by its pendant; the exterior has open sky and a horizon', () => {
    const interior = BASE_SCENES['base-interior']
    expect(interior.time).toBe('lampLit')
    expect(buildWorld(interior, baseLibrary).lamps.map((l) => l.kind)).toEqual(['pendant'])
    const exterior = BASE_SCENES['base-exterior']
    expect(exterior.time).toBe('day')
    expect(exterior.sectors.every((s) => typeof s.ceiling === 'object' && s.ceiling.sky === true)).toBe(true)
    expect(exterior.sky?.horizon?.map((h) => h.kind)).toEqual(['city'])
  })
  it('both cast the base pair, and only the base pair', () => {
    for (const name of names)
      expect(BASE_SCENES[name].cast?.map((c) => c.who).sort()).toEqual(Object.keys(BASE_PAIR).sort())
  })
  it('core registers exactly box, cylinder, model, table, bin, lamp, streetLamp and tree', () => {
    expect([...registeredPropGenerators()].sort()).toEqual(
      ['bin', 'box', 'cylinder', 'lamp', 'model', 'streetLamp', 'table', 'tree'].sort(),
    )
  })
  it('the library names nothing but DUEL swatches and generators core has', () => {
    for (const preset of Object.values(baseLibrary.props ?? {}))
      expect(registeredPropGenerators()).toContain(preset.kind)
    expect(Object.keys(baseLibrary.swatches).length).toBe(21)
  })

  // The gameplay camera stands back far enough to frame a room as the source's diorama does: the diorama's field is `h`
  // texels tall at 96 / 2.6 × 2 texels a metre, and a 50 mm lens sees 2 d tan(fov / 2) metres at distance d.
  for (const name of names) {
    it(`${name} gives each room a camera view that frames it as the source's diorama does`, () => {
      const level = BASE_SCENES[name]
      const diorama = level.views?.diorama as { h: number }
      const metres = diorama.h / ((96 / 2.6) * 2)
      const framing = metres / (2 * Math.tan((fovOf(LENS_MM) * Math.PI) / 360))
      for (const sector of level.sectors) {
        const view = level.views?.[sector.view as string]
        expect(view, `${name}: the room ${sector.id} names a view`).toBeDefined()
        expect(cameraViewSchema.safeParse(view).success).toBe(true)
        expect(Math.abs((view as { distance: number }).distance - framing)).toBeLessThan(0.3)
      }
    })
    it(`${name}'s views are the rooms' footprints, floor to ceiling`, () => {
      const level = BASE_SCENES[name]
      for (const sector of level.sectors) {
        const xs = sector.corners.map((c) => c[0])
        const zs = sector.corners.map((c) => c[1])
        const ceiling = (sector.ceiling as { z: number }).z
        const view = level.views?.[sector.view as string] as { bounds: unknown }
        expect(view.bounds).toEqual({
          min: [Math.min(...xs), 0, Math.min(...zs)],
          max: [Math.max(...xs), ceiling, Math.max(...zs)],
        })
      }
    })
  }
})
