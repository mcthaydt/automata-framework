// One drawing of a level for the game and the editor: the world, its light, and its tiles for the views it can take.
import { type Mesh3D, View3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { type DrawLevelInput, drawLevel } from '#src/app/draw-level.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { TileMaterial } from '#src/features/look/tile-material.ts'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import { createTileStore, type TileMaker } from '#src/features/photo/tile-store.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

/** A tile maker that paints a tile its pair's colour and counts what it is asked for. */
function maker(): TileMaker & { readonly asked: string[] } {
  const asked: string[] = []
  return {
    parallel: true,
    asked,
    async make(job) {
      asked.push(`${job.photo}@${job.pair.join('x')}`)
      const width = Math.max(1, job.pair[0] >> 3)
      const height = Math.max(1, job.pair[1] >> 3)
      return {
        width,
        height,
        rgba: new Uint8Array(width * height * 4).fill(255),
        labels: new Uint16Array(width * height),
        texels: job.pair,
      }
    },
  }
}

const swatches = coreLibrary.swatches as Record<string, TexturedSwatch>
const NEAR = { distance: 5, tiltDeg: 25 }
const FAR = { distance: 12, tiltDeg: 40 }

function input(
  tiles: ReturnType<typeof createTileStore>,
  extra: Partial<DrawLevelInput> = {},
): DrawLevelInput {
  return {
    level: BASE_SCENES['base-interior'],
    library: coreLibrary,
    look: DEFAULT_LOOK,
    time: timeOfDay('lampLit'),
    tiles,
    camera: NEAR,
    views: [NEAR],
    field: { short: 360 },
    ...extra,
  }
}

const drawn = (made: TileMaker) => {
  const view = new View3D({ width: 640, height: 360 })
  const tiles = createTileStore(
    () => Promise.reject(new Error('no fetch')),
    () => undefined,
    {
      swatches,
      maker: made,
    },
  )
  return { view, tiles }
}

describe('drawLevel', () => {
  it('draws the base interior with its tiles, lamps and light, asking only for the views’ pairs', async () => {
    const made = maker()
    const { view, tiles } = drawn(made)
    const level = await drawLevel(view, input(tiles))
    const meshes = level.world.pieces.map((p) => level.world.mesh(p.id) as Mesh3D)
    expect(meshes.length).toBeGreaterThan(5)
    expect(meshes.every((m) => m.material instanceof TileMaterial)).toBe(true)
    expect(level.light?.lighting.lamps.length).toBeGreaterThan(0)
    expect(meshes.some((m) => (m.material as TileMaterial).floorTile !== undefined)).toBe(true)
    // Every tile asked for is at a pair of the one view.
    const pairs = new Set(made.asked.map((a) => a.split('@')[1]))
    expect(pairs.size).toBeLessThanOrEqual(2)
    level.dispose()
  })

  it('hands the look its spot lamps that show a shaft, and its emitters', async () => {
    const { view, tiles } = drawn(maker())
    const level = await drawLevel(
      view,
      input(tiles, {
        level: {
          ...BASE_SCENES['base-exterior'],
          emitters: [{ kind: 'steam', at: [1, 0, 1] }],
        },
        time: timeOfDay('night'),
      }),
    )
    expect(level.spots.length).toBeGreaterThan(0)
    for (const spot of level.spots) {
      expect(spot.cone).toBeGreaterThan(0)
      expect(spot.range).toBeGreaterThan(0)
      expect(spot.strength).toBe(1)
    }
    expect(level.emitters).toEqual([{ kind: 'steam', at: [1, 0, 1] }])
    level.dispose()
  })

  it('swaps tiles for a new camera without rebuilding, the old tile up until the new is made', async () => {
    const made = maker()
    const { view, tiles } = drawn(made)
    const level = await drawLevel(view, input(tiles))
    const floor = level.world.pieces.find((p) => p.part === 'floor' && typeof p.surface === 'string')
    const mesh = level.world.mesh(floor?.id ?? '') as Mesh3D
    const before = level.world.pieces.map((p) => level.world.mesh(p.id))
    const material = mesh.material as TileMaterial
    const floorBefore = material.floorTile
    level.setCamera(FAR)
    // Not made yet: the old tile is still up, and the new one is queued.
    expect(material.floorTile).toBe(floorBefore)
    expect(tiles.pending).toBeGreaterThan(0)
    while (await tiles.step()) level.refresh()
    expect(level.world.pieces.map((p) => level.world.mesh(p.id))).toEqual(before)
    expect(floorBefore).toBeDefined()
    expect(material.floorTile).toBeDefined()
    expect(material.floorTile).not.toBe(floorBefore)
    level.dispose()
  })

  it('switching between the level’s views makes no tile', async () => {
    const made = maker()
    const { view, tiles } = drawn(made)
    const level = await drawLevel(view, input(tiles, { views: [NEAR, FAR] }))
    const count = tiles.made
    level.setCamera(FAR)
    level.setCamera(NEAR)
    expect(tiles.made).toBe(count)
    expect(tiles.pending).toBe(0)
    level.dispose()
  })

  it('is a no-op to set the camera it already has', async () => {
    const made = maker()
    const { view, tiles } = drawn(made)
    const level = await drawLevel(view, input(tiles))
    const count = tiles.made
    level.setCamera(NEAR)
    expect(tiles.made).toBe(count)
    expect(tiles.pending).toBe(0)
    level.dispose()
  })
})
