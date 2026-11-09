// The base interior's pendant: its pool of light on the floor, its bulb that glows while the lamp burns and goes dark when it is out.
import { type Mesh3D, View3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawLevel } from '#src/app/draw-level.ts'
import { updatePieces } from '#src/app/update-pieces.ts'
import { worldLighting } from '#src/app/world-lighting.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import type { TileMaterial } from '#src/features/look/tile-material.ts'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import { createTileStore } from '#src/features/photo/tile-store.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { noPieceStates } from '#src/shared/level/piece-states.ts'
import { bakeVertices } from '#src/shared/render/light/vertex-bake.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

const NEAR = { distance: 5, tiltDeg: 25 }
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

async function interior() {
  const view = new View3D({ width: 640, height: 360 })
  const tiles = createTileStore(
    () => Promise.reject(new Error('no fetch')),
    () => undefined,
    {
      swatches: coreLibrary.swatches as Record<string, TexturedSwatch>,
      maker: { parallel: true, make: () => Promise.reject(new Error('flat')) },
    },
  )
  const level = await drawLevel(view, {
    level: BASE_SCENES['base-interior'],
    library: coreLibrary,
    look: DEFAULT_LOOK,
    time: timeOfDay('lampLit'),
    tiles,
    camera: NEAR,
    views: [NEAR],
    field: DEFAULT_LOOK.pixel,
  })
  return level
}

describe('the pendant of the base interior', () => {
  it('pools: the floor under it is at least two steps lighter than the room’s far corner', () => {
    const world = buildWorld(BASE_SCENES['base-interior'], coreLibrary)
    const lighting = worldLighting({
      pieces: world.pieces,
      lamps: world.lamps,
      time: timeOfDay('lampLit'),
      look: DEFAULT_LOOK,
      pitch: (18 * Math.PI) / 180,
    })
    const at = [0, 0.001, 0, -3, 0.001, 3]
    const out = new Float32Array(8)
    bakeVertices(new Float32Array(at), new Float32Array([0, 1, 0, 0, 1, 0]), IDENTITY, lighting).write(
      {},
      out,
    )
    const brightest = (i: number) => Math.max(out[i * 4] ?? 0, out[i * 4 + 1] ?? 0, out[i * 4 + 2] ?? 0)
    expect(brightest(0) - brightest(1)).toBeGreaterThanOrEqual(2 * DEFAULT_LOOK.light.step - 1e-6)
  })

  it('has a bulb that glows while its lamp burns and draws unlit once the lamp is out', async () => {
    const level = await interior()
    const bulb = level.world.pieces.find((p) => p.prop?.id === 'prop0' && p.id.endsWith('bulb'))
    expect(bulb).toBeDefined()
    const mesh = level.world.mesh(bulb?.id ?? '') as Mesh3D
    expect((mesh.material as TileMaterial).glowing).toBe(true)
    const shade = level.world.pieces.find((p) => p.prop?.id === 'prop0' && p.id.endsWith('shade'))
    expect(((level.world.mesh(shade?.id ?? '') as Mesh3D).material as TileMaterial).glowing).toBe(false)

    const burning = noPieceStates()
    const out = { ...burning, lamps: { 'prop0.light0': { level: 0 } } }
    expect(updatePieces(level.world, burning, out)).toBeGreaterThan(0)
    expect(((level.world.mesh(bulb?.id ?? '') as Mesh3D).material as TileMaterial).glowing).toBe(false)
    updatePieces(level.world, out, burning)
    expect(((level.world.mesh(bulb?.id ?? '') as Mesh3D).material as TileMaterial).glowing).toBe(true)
    level.dispose()
  })
})
