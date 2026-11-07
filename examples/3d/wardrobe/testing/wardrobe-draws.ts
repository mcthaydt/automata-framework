// How a random outfit draws the wardrobe's garments (FigureBuilder cast.ts `WARDROBE`): the fields a garment's draw
// moves, the ones it moves under an outer layer, and an accessory's chance. Core's seeded random cast takes it as the
// `wardrobe` argument of `randomCharacter`; core itself has no layered garments to draw.

import type { Wear } from '@automata/3d/testing'

export const WARDROBE_DRAWS: Readonly<Record<string, Wear>> = {
  tee: {
    draw: { fit: [0.96, 1.1], length: [-0.05, 1.9] },
    under: { fit: [0.98, 1.04], length: [-0.08, 0.04], sleeves: [false] },
  },
  cargos: { draw: { width: [0.62, 0.95] } },
  sneakers: { draw: { court: [true, false] } },
  chain: { draw: { drop: [0.04, 0.2] }, chance: 0.75 },
  hoops: { draw: { size: [0.08, 0.32] }, chance: 0.4 },
  shades: { draw: { up: [true, false] }, chance: 0.3 },
}
