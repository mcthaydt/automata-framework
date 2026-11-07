// The streetwear registry: every garment in one table, which dress(), the layering and the random cast all
// read: its layer (next to the skin, the base top, over a top, the bottoms, on the feet, an accessory), its
// swatch fields with the role each plays and the kinds of swatch it takes, its builder, and for a top or a
// bottom the shape what goes over it clears. And `reachable`: the openings a hand can use in a dressed
// outfit, less those a garment worn over them covers.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246 (`Layer`,
// `Kind`, `Role`, `TAKES`, `Entry`, `GARMENTS`, `garmentOf`, `roleOf`, `fieldRole`, `reachable`), with AF's
// strict types. Swatch kinds and roles are AF's swatch fields (library/swatch.schema.ts). Not taken:
// `recombine` (the random cast is testing/random-character.ts).

import { clamp } from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import type { Skeleton } from '../../body/rig.ts'
import type { SWATCH_KINDS, SWATCH_ROLES } from '../../content/swatch.schema.ts'
import type { Anchor } from '../../figure/anchors.ts'
import type {
  Bomber,
  Cargos,
  Chain,
  Garment,
  Hoodie,
  Hoops,
  Jacket,
  Puffer,
  Shades,
  Sneakers,
  Tee,
  WideLegs,
} from '../../figure/garment.schema.ts'
import { chain, hoops, shades, sneakers } from './accessories.ts'
import { bomber, bomberShell } from './bomber.ts'
import { cargoCut, cargos, wideCut, wideLegs } from './bottoms.ts'
import { hoodie, hoodieShell } from './hoodie.ts'
import { jacket, jacketShell } from './jacket.ts'
import type { Legs } from './layering.ts'
import { frontOf, widthOf } from './loft.ts'
import { puffer, pufferShell, tee, teeShell } from './puffer-tee.ts'
import { topOf, type Worn } from './tops.ts'
import type { Fit, Wearing } from './under.ts'

/**
 * Where a garment is worn: next to the skin, the base top, over a top, the bottoms, on the feet, or an
 * accessory.
 */
export type Layer = 'under' | 'top' | 'outer' | 'bottom' | 'shoes' | 'accessory'
/** What a swatch is, apart from its colour: its cloth and finish, so a recoloured garment keeps its cloth. */
export type Kind = (typeof SWATCH_KINDS)[number]
/**
 * What a swatch is for in a garment: a garment's main cloth, a rib, its inside, a trim, a stitch, a sole,
 * hardware, a lens.
 */
export type Role = (typeof SWATCH_ROLES)[number]
/**
 * The roles of swatch a field of each role takes: a trim any garment's cloth or metal as well as a trim's
 * own.
 */
export const TAKES: Readonly<Record<Role, readonly Role[]>> = {
  main: ['main'],
  rib: ['rib'],
  inside: ['inside'],
  trim: ['trim', 'main', 'hardware'],
  stitch: ['stitch'],
  sole: ['sole'],
  hardware: ['hardware'],
  lens: ['lens'],
}

export interface Entry {
  layer: Layer
  /** Its swatch fields, each its role and the kinds of swatch it takes, its own cloth first. */
  swatches: Readonly<Record<string, readonly [Role, ...Kind[]]>>
  build: (w: Wearing, item: Garment) => Fit
  /**
   * Built after the rest of the outfit, on what is worn by then (shades pushed up onto the hair or a cap).
   */
  last?: boolean
  /** A top as worn: what goes over it clears it, a chain lies on it. */
  top?: (m: Measure, s: Skeleton, item: Garment, garments: readonly Garment[]) => Worn
  /** A bottom's cut: what a top over it clears. */
  cut?: (m: Measure, s: Skeleton, item: Garment) => Legs
}

// The registry hands each builder the garment its key named (garmentOf), so the casts below only narrow the
// union.
export const GARMENTS: Readonly<Record<string, Entry>> = {
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

/** The registry's name for a garment (the field naming its own cloth), or undefined for one not in it. */
export const garmentOf = (g: Garment): string | undefined => Object.keys(GARMENTS).find((name) => name in g)
/** The kinds of swatch a garment's field takes (the registry's), if the garment is in it. */
export const roleOf = (g: Garment, field: string): Kind[] | undefined =>
  GARMENTS[garmentOf(g) ?? '']?.swatches[field]?.slice(1) as Kind[] | undefined
/** The role a garment's field plays (the registry's), if the garment is in it. */
export const fieldRole = (g: Garment, field: string): Role | undefined =>
  GARMENTS[garmentOf(g) ?? '']?.swatches[field]?.[0]

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
