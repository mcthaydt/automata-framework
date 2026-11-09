// The lights a figure standing in a room is lit by, as a sprite lights them: at its chest, so a figure stands in a lamp's
// pool as a chair does. Each lamp that reaches the chest is a direction toward it (turned into the cell's normal-map
// frame) and its colour times its strength, its level and how much of it gets there: the lamp's falloff, and none where a
// wall or a box stands between.

import { cos, sin } from '@automata/sim/math'
import { segmentBlocked } from '../../../shared/render/light/occlusion.ts'
import type { SceneLight } from '../../../shared/render/light/scene-light.ts'
import { rgbChannels } from '../../../shared/render/texel.ts'
import type { SpriteLamp } from './sprite-light.ts'

type V3 = readonly [number, number, number]

/** The camera a light is seen from: its pitch down, and its azimuth about the vertical (0 when it looks along the room's
 * z, as the diorama's does). */
export interface LightFrame {
  readonly pitch: number
  readonly azimuth?: number | undefined
}

/** A world direction in a figure cell's normal-map frame (x right, y up, z toward the camera): turned by the camera's
 * azimuth, then pitched to look down. */
export function toCell(v: V3, azimuth: number, pitch: number): V3 {
  const c = cos(azimuth)
  const s = sin(azimuth)
  const x = v[0] * c - v[2] * s
  const z = v[0] * s + v[2] * c
  const cp = cos(pitch)
  const sp = sin(pitch)
  return [x, v[1] * cp - z * sp, v[1] * sp + z * cp]
}

/** A lamp that reaches a point: the world direction toward it (unit) and its colour times its strength, level and falloff. */
interface Reaching {
  readonly dir: V3
  readonly rgb: V3
}

function reaching(light: SceneLight, chest: V3): Reaching[] {
  const { lighting } = light
  const out: Reaching[] = []
  for (const lamp of lighting.lamps) {
    const level = light.level(lamp.id)
    if (level <= 0) continue
    const dx = lamp.x - chest[0]
    const dy = lamp.y - chest[1]
    const dz = lamp.z - chest[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (distance >= lamp.range || distance < 1e-4) continue
    if (segmentBlocked(chest[0], chest[1], chest[2], lamp.x, lamp.y, lamp.z, lighting)) continue
    const falloff = 1 - distance / lamp.range
    const reach = falloff * falloff * lamp.strength * level
    const [r, g, b] = rgbChannels(lamp.color)
    out.push({ dir: [dx / distance, dy / distance, dz / distance], rgb: [r * reach, g * reach, b * reach] })
  }
  return out
}

/** The world direction toward the lamp that lights `chest` most: where a shadow is thrown from. None when no lamp reaches. */
export function keyDirection(light: SceneLight, chest: V3): V3 | undefined {
  let best: Reaching | undefined
  let most = 0
  for (const r of reaching(light, chest)) {
    const strength = r.rgb[0] + r.rgb[1] + r.rgb[2]
    if (strength > most) {
      most = strength
      best = r
    }
  }
  return best?.dir
}

/** The sprite's lights at `chest` (world metres): the room's ambient times `ambientGain`, and one lamp for each of the
 * room's that is lit now and reaches the chest. */
export function spriteLamps(
  light: SceneLight,
  chest: V3,
  frame: LightFrame,
  ambientGain = 1,
): { readonly ambient: V3; readonly lamps: SpriteLamp[] } {
  const { lighting } = light
  const k = lighting.ambient * ambientGain
  const [ar, ag, ab] = rgbChannels(lighting.ambientColor)
  const lamps = reaching(light, chest).map((r) => ({
    dir: toCell(r.dir, frame.azimuth ?? 0, frame.pitch),
    rgb: r.rgb,
  }))
  return { ambient: [ar * k, ag * k, ab * k], lamps }
}
