// Wick's lantern (art direction spec §2, §3.4): Emberwick's Wick carries a warm light at his side (its LANTERN_RADIUS
// light and halo) and his hood has a cyan rim. Here a small glowing lantern, its light and halo, a cool light over
// his hood and a cool fill on his back ride in the hero view's container, so they follow Wick and turn with him. The figure itself is untouched; the clock sways the lantern a little.
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { CubeGeometry, Mesh3D, ParticleContainer3D, PhongMaterial, PointLight } from '@pixi/3d'
import { nightTextures } from './night-textures.ts'
import { colour } from './palette.ts'

/** Where the lantern hangs beside Wick (metres, in his frame), its light's reach and strength, and its halo's size. */
export const LANTERN = { x: 0.32, y: 0.55, z: 0.12, range: 4.5, intensity: 3, halo: 0.9 } as const
/** The cool light over his hood: Emberwick's sprite has a cyan rim on the hood; here moonlight from just above him. */
export const RIM = { y: 1.9, range: 2.6, intensity: 2.2 } as const
/**
 * A cool fill behind him: he faces +z and the camera is mostly behind him, so without it his cloak and hood are a dark
 * shape. Like the player's own light in the 3D reference game, it makes him read against the room.
 */
export const BACK_FILL = { y: 1.1, z: -0.9, range: 2.2, intensity: 1.3 } as const

/** `factory` (the hero's figure view) with the lantern added to every view it makes. */
export function withLantern(factory: View3dFactory, clock: () => number): View3dFactory {
  const wrapped: View3dFactory = (row, componentId, models, light) => {
    const view = factory(row, componentId, models, light)
    if (view === undefined) return undefined
    const warm = colour('lantern')
    const lantern = new Mesh3D({
      geometry: new CubeGeometry({ width: 0.1, height: 0.14, depth: 0.1 }),
      material: new PhongMaterial({ baseColor: warm, emissive: { color: warm, strength: 2.4 } }),
    })
    const lamp = new PointLight({ color: warm, intensity: LANTERN.intensity, range: LANTERN.range })
    const halo = new ParticleContainer3D({
      texture: nightTextures().glow,
      capacity: 1,
      blendMode: 'add',
      billboard: 'spherical',
      space: 'local',
    })
    lamp.position.set(LANTERN.x, LANTERN.y + 0.1, LANTERN.z)
    const rim = new PointLight({ color: colour('moonlight'), intensity: RIM.intensity, range: RIM.range })
    rim.position.set(0, RIM.y, 0)
    const fill = new PointLight({
      color: colour('moonlight'),
      intensity: BACK_FILL.intensity,
      range: BACK_FILL.range,
    })
    fill.position.set(0, BACK_FILL.y, BACK_FILL.z)
    view.container.addChild(lantern, lamp, halo, rim, fill)
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
