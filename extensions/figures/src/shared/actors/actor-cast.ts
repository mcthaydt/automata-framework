// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check

import { BASE } from '../base/base-pair'
import type { Pose } from '../body/rig'
import type { CharacterDef } from '../figure/cast'
import type { ActorScript, Casting, Placement } from './actor-types'
// ─── Who: a base figure or a character file ───
/** A character file (and its lookbook stand) from a base figure's id (src/shared/base/base-pair.ts) or the file itself. */
export function characterOf(who: string | CharacterDef): { def: CharacterDef; pose?: string } {
  if (typeof who === 'object') return { def: who }
  const b = BASE.find((c) => c.def.id === who)
  if (!b)
    throw new Error(
      `no figure ${who} (a base id: ${BASE.map((c) => c.def.id).join(', ')}, or a character file)`,
    )
  return { def: b.def, pose: b.pose }
}

export const deg = (d: number) => (d * Math.PI) / 180
/** Turn speeds (rad/s): to a new way of walking at a corner, and to a face key. */
export const CORNER = 9,
  TURN = 5
/** The head and chest turn this far to a look target (rad); past it, the body turns. Blends between targets over LOOK s. */
export const NECK = 1.45,
  LOOK = 0.35
/** A stand blends in and out over STAND s. */
export const STAND = 0.35
/** A pose's cache key: its numbers, to a tenth of a millimetre and a ten-thousandth of a radian. */
export function keyOf(p: Pose): string {
  let h = 2166136261
  const put = (v: number) => {
    h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619)
  }
  put(p.yaw)
  p.root.forEach(put)
  for (const q of p.rot) q.forEach(put)
  for (const v of p.shift) v.forEach(put)
  return `a${(h >>> 0).toString(36)}`
}
/** A placement as a script: it walks to `to` at its gait's speed (facing its way), and holds `pose` while it stands
 * ('hero' its own lookbook stand). A script passes through. */
export function scriptOf(c: Casting): ActorScript {
  const p = c as Placement & Partial<ActorScript>
  if (p.to === undefined && p.pose === undefined) return c as ActorScript
  const { to, pose, ...rest } = p
  const stand = pose === 'hero' ? characterOf(p.who).pose : pose
  return {
    ...rest,
    ...(to ? { path: [...(rest.path ?? []), { at: to }] } : {}),
    ...(stand ? { stands: [...(rest.stands ?? []), { t: 0, pose: stand }] } : {}),
  }
}
