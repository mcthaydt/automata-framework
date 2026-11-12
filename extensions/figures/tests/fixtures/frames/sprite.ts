// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check
/**
 * The sprite-light golden's frames (c8-lit): the base pair, 8 directions standing at D2, lit as a sprite (`lightSprite`)
 * under four lights, each kept as an md5 of the frame's RGBA and named `<who>/<light>/<facing>`. The lights are in the
 * figure's lighting frame: none (flat 1, no lamps), a warm lamp from the left, a dim grey room, and noon.
 * Shared by the recorder (scripts/golden.ts), the contact sheet (scripts/lit.ts) and the test (tests/unit/golden/sprite.test.ts).
 */
import { createHash } from 'node:crypto'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { lightSprite, type SpriteLighting } from '#src/shared/lighting/sprite.ts'

export const SPRITE_LIGHTS: Record<string, SpriteLighting> = {
  none: { flat: [1, 1, 1], lamps: [] },
  warmLeft: { flat: [1.3, 1.1, 0.8], lamps: [{ dir: [-0.8, 0.4, 0.45], strength: 0.8 }] },
  dim: { flat: [0.5, 0.5, 0.5], lamps: [] },
  noon: { flat: [1.6, 1.6, 1.6], lamps: [{ dir: [0.2, 0.9, 0.4], strength: 0.6 }] },
}
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex')

/** A base figure standing in view `d` of the 8 at density 2, at the sheets' pitch. */
export function standingFigure(who: string, d: number): Figure {
  const f = new Figure(member(BASE.find((c) => c.def.id === who)!.def, 2))
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return f
}
/** Every frame: name → md5. */
export function spriteLitFrames(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of BASE)
    for (let d = 0; d < 8; d++) {
      const f = standingFigure(c.def.id, d)
      for (const [name, L] of Object.entries(SPRITE_LIGHTS))
        out[`${c.def.id}/${name}/${d}`] = md5(lightSprite(f, L))
    }
  return out
}
