// What a garment kind built into the dressed body is made of, and what it hands back: the contract between `dress` and
// an extension's garment builders (the wardrobe). Core owns the shapes; the builders live with the extension. A kind's
// builder gets a `Wearing` (the body, the outfit, the variants made so far, the parts already worn) and returns a `Fit`.
// A top also describes itself as a `Worn` (so what goes over it clears it and a chain lies on it), a bottom as `Legs`
// (so a top over it clears its cut); both are built from `Shell`s and `Section`s.

import type { Measure } from '../body/genes.ts'
import type { Decal, Part } from '../body/mesh.ts'
import type { Body } from '../body/profiles.ts'
import type { Skeleton } from '../body/rig.ts'
import type { Anchor } from '../figure/anchors.ts'
import type { Garment } from '../figure/garment.schema.ts'
import type { Made } from '../figure/materials.ts'

/** The body's regions a garment repaints (garments/body.ts Regions). */
export type Paint = Partial<
  Record<
    | 'chest'
    | 'waist'
    | 'shoulder'
    | 'upper'
    | 'fore'
    | 'pelvis'
    | 'thigh'
    | 'knee'
    | 'shin'
    | 'shoe'
    | 'sole',
    string
  >
>

/** What a garment adds to a dressed body: its parts and marks, the body regions it repaints (so the body
 * under it is its cloth wherever a joint opens a gap), and the openings a hand can go to. */
export interface Fit {
  parts: Part[]
  decals?: Decal[]
  paint?: Paint
  anchors?: Anchor[]
}

/**
 * What a garment's builder is given: the body, the whole outfit, the variants made so far, the parts already
 * worn.
 */
export interface Wearing {
  m: Measure
  s: Skeleton
  garments: readonly Garment[]
  made: Made
  worn: readonly Part[]
  /** The body under the clothes as a query: size a sleeve end, a cuff or a hem from `body.girth(...)` plus `body.clear`. */
  body: Body
}

/**
 * A section across a loft's axis: its centre and half-widths, and its roundness (1 an ellipse, ~0.4 a rounded
 * box).
 */
export interface Section {
  c: [number, number]
  r: [number, number]
  e?: number
}

/** A shell's description in rest figure space, so a chain or a zip can lie on it. */
export interface Shell {
  from: number
  to: number
  section: (t: number) => Section
  bump?: ((t: number, v: number) => number) | undefined
  /** Where it is open (a jacket's V). */
  open?: (x: number, y: number) => boolean
}

/**
 * A top as worn: its shell, its cloth, the neck it leaves, its collar's description if it stands one, its
 * lowest edge.
 */
export interface Worn {
  shell: Shell
  cloth: string
  neck: number
  collar?: Shell
  foot?: number
}

/** A trouser cut: its legs from the hip (`top`) to `hem`, `radius(t)` round (t 0 the hip, 1 the hem), `folds`
 * the most its folds swell it (a fraction of its round), so its legs stand apart by their fullest. */
export interface Legs {
  top: number
  hem: number
  radius: (t: number) => number
  folds?: number
}
