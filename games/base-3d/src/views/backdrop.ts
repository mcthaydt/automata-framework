// The night beyond the walls (art direction spec §2, §4.7): Emberwick's backdrop layers in 3D. Pines and ruined
// towers are crossed pairs of cut-out quads, one mesh a layer, unfogged so they stay crisp past the fog (particles
// fog by their blend mode, which is why these are meshes); the moon is a cut-out disc with an additive glow; stars are
// additive motes behind it.
import { Container3D, FlatMaterial, Geometry3D, Mesh3D, ParticleContainer3D, PlaneGeometry } from '@pixi/3d'
import type { Texture } from 'pixi.js'
import type { Card, Dressing } from './dressing.ts'
import type { NightTextures } from './night-textures.ts'
import { colour } from './palette.ts'

/** Two quads crossed at right angles per card, standing on its `y`, as wide as half its height. */
export function crossedCards(cards: readonly Card[], texture: Texture, tint: number): Mesh3D {
  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const { x, y, z, size } of cards) {
    const half = size / 4
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const base = positions.length / 3
      positions.push(
        x - dx * half,
        y,
        z - dz * half,
        x + dx * half,
        y,
        z + dz * half,
        x + dx * half,
        y + size,
        z + dz * half,
        x - dx * half,
        y + size,
        z - dz * half,
      )
      uvs.push(0, 1, 1, 1, 1, 0, 0, 0)
      normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1)
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  const geometry = new Geometry3D({
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  })
  const material = new FlatMaterial({
    baseColorTexture: texture,
    baseColor: tint,
    alphaMode: 'mask',
    alphaCutoff: 0.5,
    fog: false,
    doubleSided: true,
  })
  return new Mesh3D({ geometry, material })
}

/** The stars' places on the sky behind the arch: a fixed spread, so every build draws the same sky. */
function stars(dressing: Dressing): Card[] {
  const spread: Card[] = []
  let seed = 7
  const next = (): number => {
    seed = (seed * 48271) % 2147483647
    return (seed % 1000) / 1000
  }
  for (let i = 0; i < 70; i++)
    spread.push({
      x: next() * 120 - 60,
      y: -2 + next() * 30,
      z: dressing.moon.z + 14,
      size: 0.35 + (i % 3) * 0.12,
    })
  return spread
}

/** Builds the backdrop under `parent`. */
export function buildBackdrop(parent: Container3D, dressing: Dressing, textures: NightTextures): void {
  const layer = new Container3D({ label: 'night:backdrop' })
  // Silhouettes a touch lighter than black, as Emberwick's layers are: the towers in the far blue, the pines in the night.
  const towers = crossedCards(dressing.towers, textures.tower, 0x9a9aa8)
  const pines = crossedCards(dressing.pines, textures.pine, 0x6a6a7a)
  const moon = new Mesh3D({
    geometry: new PlaneGeometry({ width: dressing.moon.size, height: dressing.moon.size }),
    material: new FlatMaterial({
      baseColorTexture: textures.moon,
      alphaMode: 'mask',
      alphaCutoff: 0.5,
      fog: false,
      doubleSided: true,
    }),
  })
  moon.position.set(dressing.moon.x, dressing.moon.y, dressing.moon.z)
  const sky = new ParticleContainer3D({
    label: 'night:sky',
    texture: textures.glow,
    capacity: 80,
    blendMode: 'add',
    billboard: 'spherical',
  })
  const { x, y, z, size } = dressing.moon
  sky.setParticleAt(0, x, y, z - 1, size * 2.8, 0, colour('moonlight'), 0.3)
  stars(dressing).forEach((star, i) => {
    sky.setParticleAt(
      i + 1,
      star.x,
      star.y,
      star.z,
      star.size,
      0,
      colour(i % 3 === 0 ? 'moon' : 'moonShade'),
      0.9,
    )
  })
  layer.addChild(sky, towers, moon, pines)
  parent.addChild(layer)
}
