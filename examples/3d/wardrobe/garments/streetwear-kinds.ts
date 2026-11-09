// The streetwear garments, registered in the garment registry (core's `registerGarment`) when this file loads: each
// with its layer (next to the skin, the base top, over a top, the bottoms, on the feet, an accessory), its swatch
// fields with the role each plays and the kinds of swatch it takes, its builder, and for a top or a bottom the shape
// what goes over it clears. And `reachable`: the openings a hand can use in a dressed outfit, less those a garment
// worn over them covers, which the wardrobe sets as the outfit hook that picks a dressed figure's openings.
//
// The parts here (`Layer`,
// `Kind`, `Role`, `TAKES`, `Entry`, `GARMENTS`, `garmentOf`, `roleOf`, `fieldRole`, `reachable`), with AF's
// strict types. Swatch kinds and roles are AF's swatch fields (library/swatch.schema.ts). Not taken:
// `recombine` (the random cast is core's testing/random-character.ts).

import type { Anchor, Garment, Measure, Skeleton } from '@automata/3d/figures-kit'
import {
  clamp,
  GARMENTS,
  type GarmentKind,
  garmentOf,
  registerGarment,
  registerOutfitHooks,
} from '@automata/3d/figures-kit'
import { chain, hoops, shades, sneakers } from './accessories.ts'
import { bomber, bomberShell } from './bomber.ts'
import { cargoCut, cargos, wideCut, wideLegs } from './bottoms.ts'
import { STREETWEAR_SCHEMAS } from './garment-schemas.ts'
import type {
  Bomber,
  Cargos,
  Chain,
  Hoodie,
  Hoops,
  Jacket,
  Puffer,
  Shades,
  Sneakers,
  Tee,
  WideLegs,
} from './garment-types.ts'
import { hoodie, hoodieShell } from './hoodie.ts'
import { jacket, jacketShell } from './jacket.ts'
import { frontOf, widthOf } from './loft.ts'
import { puffer, pufferShell, tee, teeShell } from './puffer-tee.ts'
import { topOf } from './tops.ts'

// The registry hands each builder the garment its key named (garmentOf), so the casts below only narrow the
// union.
const STREETWEAR: Readonly<Record<string, Omit<GarmentKind, 'schema'>>> = {
  tee: {
    layer: 'top',
    swatches: { tee: ['main', 'knit'], rib: ['rib', 'knit'] },
    build: (w, g) => tee(w, g as Tee),
    top: (m, s, g, gs) => teeShell(m, s, g as Tee, gs),
  },
  hoodie: {
    layer: 'top',
    swatches: {
      hoodie: ['main', 'knit'],
      rib: ['rib', 'knit'],
      inside: ['inside', 'knit'],
      cords: ['stitch', 'thread'],
      aglets: ['trim', 'lens', 'metal'],
    },
    build: (w, g) => hoodie(w, g as Hoodie),
    top: (m, s, g, gs) => hoodieShell(m, s, g as Hoodie, gs),
  },
  puffer: {
    layer: 'outer',
    swatches: { puffer: ['main', 'cloth'], trim: ['trim', 'cloth'], zip: ['stitch', 'thread'] },
    build: (w, g) => puffer(w, g as Puffer),
    top: (m, s, g, gs) => pufferShell(m, s, g as Puffer, gs),
  },
  jacket: {
    layer: 'outer',
    swatches: { jacket: ['main', 'leather'], hardware: ['hardware', 'metal'] },
    build: (w, g) => jacket(w, g as Jacket),
    top: (m, s, g, gs) => jacketShell(m, s, g as Jacket, gs),
  },
  bomber: {
    layer: 'outer',
    swatches: {
      bomber: ['main', 'leather'],
      rib: ['rib', 'knit'],
      hardware: ['hardware', 'metal'],
      tipping: ['trim', 'lens'],
    },
    build: (w, g) => bomber(w, g as Bomber),
    top: (m, s, g, gs) => bomberShell(m, s, g as Bomber, gs),
  },
  wideLegs: {
    layer: 'bottom',
    swatches: {
      wideLegs: ['main', 'denim', 'twill'],
      stitch: ['stitch', 'thread'],
      hardware: ['hardware', 'metal'],
    },
    build: (w, g) => wideLegs(w, g as WideLegs),
    cut: (m, s) => wideCut(m, s),
  },
  cargos: {
    layer: 'bottom',
    swatches: {
      cargos: ['main', 'twill', 'denim'],
      hardware: ['hardware', 'metal'],
      stitch: ['stitch', 'thread'],
    },
    build: (w, g) => cargos(w, g as Cargos),
    cut: (m, s, g) => cargoCut(m, s, g as Cargos),
  },
  sneakers: {
    layer: 'shoes',
    swatches: {
      sneakers: ['main', 'leather'],
      mudguard: ['trim', 'leather', 'cloth', 'knit'],
      sole: ['sole', 'rubber'],
      outsole: ['sole', 'rubber', 'twill'],
      laces: ['stitch', 'thread'],
      tab: ['trim', 'knit'],
    },
    build: (w, g) => sneakers(w, g as Sneakers),
  },
  chain: {
    layer: 'accessory',
    swatches: { chain: ['hardware', 'metal'], links: ['hardware', 'metal'] },
    build: (w, g) => chain(w, g as Chain),
  },
  hoops: {
    layer: 'accessory',
    swatches: { hoops: ['hardware', 'metal'] },
    build: (w, g) => hoops(w, g as Hoops),
  },
  shades: {
    layer: 'accessory',
    swatches: { shades: ['lens', 'lens'], frame: ['trim', 'metal', 'leather'] },
    last: true,
    build: (w, g) => shades(w, g as Shades),
  },
}

// Registered on load (an extension has no setup hook), and only after the classic set: `@automata/3d/figures-kit`
// registers the classic garments when it loads, and the garments are told apart in registration order.
for (const [name, kind] of Object.entries(STREETWEAR)) {
  const schema = STREETWEAR_SCHEMAS[name]
  if (!schema) throw new Error(`streetwear garment ${name} has no schema`)
  registerGarment(name, { ...kind, schema })
}

/**
 * The openings a hand can reach in a dressed outfit: each garment's anchors, less those an outer garment
 * covers there (a top's shell spanning the opening's height round it, worn over it: any top over the bottoms,
 * a later top over an earlier one). So a trouser pocket under a tall tee's hem is gone and the tee's own hem
 * offers itself instead.
 */
export function reachable(
  m: Measure,
  s: Skeleton,
  garments: readonly Garment[],
  worn: readonly { anchor: Anchor; from: Garment }[],
): Anchor[] {
  const k = m.k
  const shells = garments.map((g, i) => ({ i, top: topOf(m, s, g, garments) }))
  return worn
    .filter(({ anchor: a, from }) => {
      const i = garments.indexOf(from)
      const mine = GARMENTS[garmentOf(from) ?? '']?.layer
      return !shells.some(({ i: j, top }) => {
        if (!top || j === i || (mine !== 'bottom' && j < i)) return false
        const [x, y, z] = a.at
        const sh = top.shell
        if (y > sh.from || y < Math.min(sh.to, top.foot ?? sh.to) - 0.004 * k || sh.open?.(x, y)) return false
        // Round it there: inside its width, and (for one on the front or back) behind its surface.
        return (
          Math.abs(x) <= widthOf(sh, clamp(y, sh.to, sh.from)) + 0.004 * k &&
          (z <= 0 || (frontOf(sh, x, clamp(y, sh.to, sh.from)) ?? -Infinity) >= z - 0.01 * k)
        )
      })
    })
    .map((w) => w.anchor)
}

registerOutfitHooks({ anchors: (worn, _parts, { m, s, garments }) => reachable(m, s, garments, worn) })
