// Particles: steam, drips, moths, flames and embers, each one a cell of one to three pixels drawn through the figures'
// composite pass, so they stand at whole field pixels, are hidden by a nearer wall and hazed and snapped with the rest.
// Every particle is cut from one small atlas (a block a colour), so all of a frame's particles are one draw call.

import type { Texture } from 'pixi.js'
import type { EmitterPlace } from '../../../shared/level/af-sector-2.schema.ts'
import { packDepth, packedDepthBytes } from '../../../shared/render/alpha/alpha-codes.ts'
import { type CellCompositePass, cellTexture, type PlacedCell } from './cell-composite-pass.ts'
import { dotsOf, PARTICLE_COLOURS } from './particle-motion.ts'

/** What the layer reads of the view: the camera's transform, and where a world point lands in the field. */
export interface ParticleView {
  readonly camera: { getGlobalTransform(): { readonly elements: ArrayLike<number> } }
  worldToScreen(position: { x: number; y: number; z: number }): { x: number; y: number } | null
}

export interface ParticleLayer {
  /** Lets `emitter` off from the next frame; the returned function stops it. */
  add(emitter: EmitterPlace): () => void
  /** Shows the particles at `seconds`. */
  frame(seconds: number, view: ParticleView): void
  dispose(): void
}

/** The side of an atlas block: the largest particle. */
const BLOCK = 3

/** The atlas: a block of each colour, and a depth of zero everywhere (a particle is a flat point at its root's depth). */
function atlas(): { colours: Texture; depth: Texture } {
  const width = PARTICLE_COLOURS.length * BLOCK
  const colours = new Uint8Array(width * BLOCK * 4)
  const depth = new Uint8Array(width * BLOCK * 4)
  const [hi, lo] = packedDepthBytes(packDepth(0))
  for (let y = 0; y < BLOCK; y++)
    for (let x = 0; x < width; x++) {
      const colour = PARTICLE_COLOURS[Math.floor(x / BLOCK)] as number
      const k = (y * width + x) * 4
      colours.set([(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255], k)
      depth.set([hi, lo, 0, 255], k)
    }
  return { colours: cellTexture(colours, width, BLOCK), depth: cellTexture(depth, width, BLOCK) }
}

/**
 * The layer, drawing through `pass`. `look.particles` is the look's switch: off, nothing is shown. The cells it adds are
 * its own, so the figures that share the pass are not disturbed.
 */
export function createParticleLayer(
  pass: CellCompositePass,
  look: { readonly particles: boolean },
): ParticleLayer {
  const emitters = new Set<EmitterPlace>()
  let textures: { colours: Texture; depth: Texture } | undefined

  return {
    add(emitter) {
      emitters.add(emitter)
      return () => {
        emitters.delete(emitter)
      }
    },
    frame(seconds, view) {
      if (!look.particles || emitters.size === 0) {
        pass.show([], 'particles')
        return
      }
      textures ??= atlas()
      const e = view.camera.getGlobalTransform().elements
      const eye = [e[12] ?? 0, e[13] ?? 0, e[14] ?? 0] as const
      // The camera looks along its own -z.
      const forward = [-(e[8] ?? 0), -(e[9] ?? 0), -(e[10] ?? 0)] as const
      const placed: PlacedCell[] = []
      let index = 0
      for (const emitter of emitters) {
        for (const dot of dotsOf(emitter, index++, seconds)) {
          const [x, y, z] = dot.at
          const rootDepth = (x - eye[0]) * forward[0] + (y - eye[1]) * forward[1] + (z - eye[2]) * forward[2]
          if (rootDepth <= 0) continue
          const screen = view.worldToScreen({ x, y, z })
          if (screen === null) continue
          const side = Math.floor(dot.size / 2)
          placed.push({
            colours: textures.colours,
            depth: textures.depth,
            source: [PARTICLE_COLOURS.indexOf(dot.colour) * BLOCK, 0],
            x: Math.floor(screen.x) - side,
            y: Math.floor(screen.y) - side,
            width: dot.size,
            height: dot.size,
            rootDepth,
          })
        }
      }
      pass.show(placed, 'particles')
    },
    dispose() {
      emitters.clear()
      pass.show([], 'particles')
      textures?.colours.destroy(true)
      textures?.depth.destroy(true)
      textures = undefined
    },
  }
}
