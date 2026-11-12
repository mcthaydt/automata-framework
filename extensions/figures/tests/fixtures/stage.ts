import { dressed } from './draw'

/**
 * What the stage's tests share. The denim is the one tests/unit/paint/fabric.test.ts dresses: a twill top and shorts
 * in the test fabric `fx-twill` (tests/fixtures/fabrics.ts, registered by `registerFixtures`). Base
 * registers no fabric, so a tiled cloth reaches the stage only through a fixture that lives under tests/.
 */
export const DENIM_DEF = dressed([{ top: 'fxtwill', sleeves: 'long' }, { shorts: 'fxtwill' }], {
  fxtwill: { ramp: 26, base: 3, fabric: 'fx-twill' },
})

import { createHash } from 'node:crypto'
import { type CameraPose, lookAt } from '#src/shared/stage/pose.ts'

/** An orthographic pose at the sheets' 18°, `zoom` pixels per D1 texel, round `look` (20 m back along the view). */
export const ortho = (
  zoom: number,
  size: [number, number],
  look: [number, number, number] = [0, 1, 0],
): CameraPose => {
  const p = (18 * Math.PI) / 180
  return lookAt(
    [look[0], look[1] + 20 * Math.sin(p), look[2] + 20 * Math.cos(p)],
    look,
    { pixelsPerMetre: (zoom * 96) / 2.6 },
    size,
  )
}
/** The md5 of a buffer, hex. */
export const md5 = (b: Uint8ClampedArray) => createHash('md5').update(b).digest('hex')
/** The set of opaque colours (r << 16 | g << 8 | b) in an RGBA buffer. */
export const coloursOf = (px: Uint8ClampedArray) => {
  const s = new Set<number>()
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) s.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])
  return s
}
