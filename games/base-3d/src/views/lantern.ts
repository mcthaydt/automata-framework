// Wick's lantern (art direction spec §2, §3.4): Emberwick's Wick carries a warm light at his side. Here a small
// glowing lantern and its halo ride in the hero view's container, so they follow Wick and turn with him; the clock
// sways it a little. No real-time light (the Owner: "no real time"): the night's light is baked, and Wick takes it at
// his chest each frame (the figure view's tint).
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { CubeGeometry, FlatMaterial, Mesh3D, ParticleContainer3D } from '@pixi/3d'
import { nightTextures } from './night-textures.ts'
import { colour } from './palette.ts'

/** Where the lantern hangs beside Wick (metres, in his frame) and its halo's size. */
export const LANTERN = { x: 0.32, y: 0.55, z: 0.12, halo: 0.9 } as const

/** `factory` (the hero's figure view) with the lantern added to every view it makes. */
export function withLantern(factory: View3dFactory, clock: () => number): View3dFactory {
  const wrapped: View3dFactory = (row, componentId, models, light) => {
    const view = factory(row, componentId, models, light)
    if (view === undefined) return undefined
    const warm = colour('lantern')
    // Unlit: it glows at its own colour. No real-time light: the night is baked, and Wick takes its light at his chest.
    const lantern = new Mesh3D({
      geometry: new CubeGeometry({ width: 0.1, height: 0.14, depth: 0.1 }),
      material: new FlatMaterial({ baseColor: warm }),
    })
    const halo = new ParticleContainer3D({
      texture: nightTextures().glow,
      capacity: 1,
      blendMode: 'add',
      billboard: 'spherical',
      space: 'local',
    })
    view.container.addChild(lantern, halo)
    const sway = (): void => {
      const swing = Math.sin(clock() * 3) * 0.02
      lantern.position.set(LANTERN.x + swing, LANTERN.y, LANTERN.z)
      halo.setParticleAt(0, LANTERN.x + swing, LANTERN.y, LANTERN.z, LANTERN.halo, 0, colour('ember'), 0.7)
    }
    sway()
    return {
      container: view.container,
      update: (curr, prev, alpha) => {
        view.update?.(curr, prev, alpha)
        sway()
      },
      destroy: () => view.destroy?.(),
    }
  }
  return factory.models === undefined ? wrapped : Object.assign(wrapped, { models: factory.models })
}
