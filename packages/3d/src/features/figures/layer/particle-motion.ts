// Where each kind of emitter's particles are at a moment: steam rising and thinning, drops falling off an edge, moths
// circling a lamp, a flame's tongue, embers lifting off. Each particle is a point in the world with a colour and a size of
// one to three pixels; the layer turns them into cells. Time is quantized to twelfths of a second, so the motion steps the
// way the rest of the look does and a still frame repeats exactly.

import { DEFAULT_PALETTE, nearestDuel } from '@automata/content/palette'
import { cos, sin } from '@automata/sim/math'
import type { EmitterPlace } from '../../../shared/level/af-sector-2.schema.ts'

type V3 = readonly [number, number, number]

/** One particle: where it is, its colour (`0xRRGGBB`) and how many pixels across it is. */
export interface Dot {
  readonly at: V3
  readonly colour: number
  readonly size: 1 | 2 | 3
}

/**
 * The colours the particles use, each the DUEL colour nearest the one named: a painted pixel is not snapped again, so a
 * particle has to be a palette colour itself. The layer's atlas holds one block of each.
 */
export const PARTICLE_COLOURS: readonly number[] = [
  '#cdd2da',
  '#848795',
  '#88d6ff',
  '#f99b4e',
  '#ffbc4e',
  '#ffe949',
  '#3c3151',
  '#c24b3a',
  '#f7f4bf',
].map((hex) => Number.parseInt((DEFAULT_PALETTE.colors[nearestDuel(hex)] as string).slice(1), 16))
const [STEAM_LIGHT, STEAM_DARK, DROP, FLAME_ORANGE, FLAME_GOLD, FLAME_HOT, MOTH, EMBER_DIM] =
  PARTICLE_COLOURS as [number, number, number, number, number, number, number, number]

/** A hash of three integers to [0, 1). */
function hash(a: number, b: number, c: number): number {
  let n = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

const size = (radius: number): 1 | 2 | 3 => (radius < 0.5 ? 1 : radius < 1.5 ? 2 : 3)

/** The particles of `emitter` (the `index`-th of its layer, so two alike do not move together) at `seconds`. */
export function dotsOf(emitter: EmitterPlace, index: number, seconds: number): Dot[] {
  const [x, y, z] = emitter.at
  const tick = Math.floor(seconds * 12)
  const tk = tick / 12
  const out: Dot[] = []
  if (emitter.kind === 'steam')
    for (let i = 0; i < 7; i++) {
      // Puffs rise and spread over two seconds, light low, broken as they thin.
      const phase = (tk * 0.5 + i / 7 + index * 0.13) % 1
      if (phase > 0.7 && (i + tick) % 2 === 1) continue
      out.push({
        at: [x + sin(phase * 5 + i) * 0.12 * phase, y + phase * 1.6, z + cos(phase * 4 + i) * 0.08],
        colour: phase < 0.45 ? STEAM_LIGHT : STEAM_DARK,
        size: size(0.6 + phase * 1.6),
      })
    }
  if (emitter.kind === 'drip' && emitter.to !== undefined)
    for (let i = 0; i < 6; i++) {
      // Drops fall off the edge to the ground in half a second, each from its own place along it.
      const along = hash(i, index, 5)
      const phase = (tk * 2 + hash(i, index, 9)) % 1
      const ground = emitter.ground ?? 0
      out.push({
        at: [
          x + (emitter.to[0] - x) * along,
          y - (y - ground) * phase * phase,
          z + (emitter.to[2] - z) * along,
        ],
        colour: DROP,
        size: 1,
      })
    }
  if (emitter.kind === 'flame') {
    // A hot core under a flickering tongue, a texel's lick up now and then.
    const lick = hash(index, tick, 3) > 0.5 ? 0.03 : 0
    out.push({ at: [x, y + 0.02, z], colour: FLAME_ORANGE, size: 2 })
    out.push({ at: [x, y + 0.06 + lick, z], colour: FLAME_GOLD, size: 2 })
    out.push({ at: [x, y + 0.05, z], colour: FLAME_HOT, size: 1 })
  }
  if (emitter.kind === 'moth')
    for (let i = 0; i < 3; i++) {
      // Moths circle the lamp, erratic, dark against its glow.
      const angle = tk * (3 + i) + i * 2.1
      const radius = 0.25 + 0.15 * sin(tk * 7 + i * 3)
      out.push({
        at: [x + cos(angle) * radius, y - 0.15 + sin(tk * 5 + i) * 0.15, z + sin(angle) * radius],
        colour: MOTH,
        size: 1,
      })
    }
  if (emitter.kind === 'ember')
    for (let i = 0; i < 5; i++) {
      // Sparks lift off, sway and go dim as they rise, each on its own beat.
      const phase = (tk * 0.6 + hash(i, index, 11)) % 1
      out.push({
        at: [x + sin(phase * 6 + i * 2) * 0.15, y + phase * 1.2, z + cos(phase * 5 + i) * 0.1],
        colour: phase < 0.5 ? FLAME_GOLD : phase < 0.8 ? FLAME_ORANGE : EMBER_DIM,
        size: 1,
      })
    }
  return out
}
