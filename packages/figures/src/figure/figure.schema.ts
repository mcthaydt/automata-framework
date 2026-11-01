// The figure content kind (M3 spec §4.4.1 `FigureDef`): a character as data. Sliders and gene overrides make
// its skeleton, library ids (or inline values) make its look and motion. The shape is FigureBuilder's
// character file (src/render/figure/cast.ts `CharacterDef` at a1f7246) without its sprite fields (`face.camera`
// and `face.turn`, `play`, `atlasOutfit`, `story`) and without per-figure swatches (a figure's colours are
// library swatches, so every one is a palette colour checked in one place).

import { contentRef } from '@mcthaydt/automata-content/schema'
import { z } from 'zod'
import type { HeadShape, Sliders } from '../genes/genes'
import { type Gait, gaitOverridesSchema, gaitSchema } from '../library/gait.schema'
import { refOrInline } from '../library/ref-or-inline'
import { partialOf, side } from '../library/shapes.schema'
import type { Genes } from '../rig/rig'
import { skeletonProblems } from './figure-skeleton'
import { type Garment, garmentSchema } from './garment.schema'

/** The hair's spring (FigureBuilder cast.ts `HairPhysics`): stiffness and damping, trail, bounce, sway, hang. */
export interface HairDynamics {
  readonly stiff: number
  readonly damp: number
  readonly trail: number
  readonly bounce: number
  readonly sway: number
  readonly hang: number
}

export interface FigureDef {
  readonly sliders: Partial<Sliders>
  readonly genes?: Partial<Genes> | undefined
  /** A swatch id. */
  readonly skin: string
  /** A gait id, or a gait written inline. */
  readonly gait: string | Gait
  /** Any of the gait's numbers changed for this figure, on top of the named or inline gait. */
  readonly gaitOverrides?: Partial<Gait> | undefined
  /** The hand that holds items. */
  readonly hand: 'L' | 'R'
  readonly outfits: Readonly<Record<string, readonly Garment[]>>
  /** The outfit worn when the sim names none. */
  readonly default: string
  readonly hair?: Partial<HairDynamics> | undefined
  /**
   * Hair style ids from the hair library (the spec's `hairPieces`): the figure's own hair, worn by every
   * outfit whose `{ hair }` garment names no style, each piece in that garment's colour and under the
   * outfit's cap (M3.5b decision 6). A hair garment with a style wears that style instead.
   */
  readonly hairPieces?: readonly string[] | undefined
  /** A stand id for idle; the relaxed idle if omitted. */
  readonly stand?: string | undefined
  /** A rig-limits id; the shared default if omitted. */
  readonly rig?: string | undefined
}

/**
 * Slider ranges, from The Last Light's builder check (scripts/figures/check-lib.ts at 92e6704): the height in
 * centimetres and the head's tilt in degrees have their own; every other slider runs 0–1 and may go a little
 * past either end, for figures meant to look wrong.
 */
const beyond = z.number().min(-1).max(2)
const headShape: z.ZodType<Partial<HeadShape>> = partialOf<HeadShape>(
  z.strictObject({
    width: beyond.optional(),
    jaw: beyond.optional(),
    chin: beyond.optional(),
    cheekHeight: beyond.optional(),
    cheekWidth: beyond.optional(),
    bridge: beyond.optional(),
    nose: beyond.optional(),
    lips: beyond.optional(),
    browArch: beyond.optional(),
    browWeight: beyond.optional(),
    browHeight: beyond.optional(),
    crease: beyond.optional(),
    hood: beyond.optional(),
    liner: beyond.optional(),
  }),
)
const sliders: z.ZodType<Partial<Sliders>> = partialOf<Sliders>(
  z.strictObject({
    frame: beyond.optional(),
    height: z.number().min(120).max(240).optional(),
    muscle: beyond.optional(),
    fat: beyond.optional(),
    shoulders: beyond.optional(),
    hips: beyond.optional(),
    legs: beyond.optional(),
    arms: beyond.optional(),
    head: beyond.optional(),
    neck: beyond.optional(),
    neckLength: beyond.optional(),
    hands: beyond.optional(),
    feet: beyond.optional(),
    posture: beyond.optional(),
    age: beyond.optional(),
    headTilt: z.number().min(-30).max(30).optional(),
    chunk: beyond.optional(),
    faceForward: beyond.optional(),
    hunch: beyond.optional(),
    face: headShape.optional(),
  }),
)
/** Rig genes set directly, after the sliders (FigureBuilder's `genes`, for figures meant to look wrong). */
const n = z.number().optional()
const genes: z.ZodType<Partial<Genes>> = partialOf<Genes>(
  z.strictObject({
    height: n,
    head: n,
    headWidth: n,
    headDepth: n,
    neck: n,
    shoulders: n,
    hips: n,
    legs: n,
    arms: n,
    forearm: n,
    ankle: n,
    foot: n,
    build: n,
    posture: n,
    headTilt: n,
    headPitch: n,
    faceAhead: n,
    hunch: n,
  }),
)
const hairDynamics: z.ZodType<Partial<HairDynamics>> = partialOf<HairDynamics>(
  z.strictObject({
    stiff: z.number().positive().optional(),
    damp: z.number().min(0).optional(),
    trail: n,
    bounce: n,
    sway: n,
    hang: n,
  }),
)

export const figureSchema: z.ZodType<FigureDef> = z
  .strictObject({
    sliders,
    genes: genes.optional(),
    skin: contentRef('figure-swatch'),
    gait: refOrInline<Gait>('figure-gait', { object: gaitSchema }),
    gaitOverrides: gaitOverridesSchema.optional(),
    hand: side,
    outfits: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), z.array(garmentSchema).min(1)),
    default: z.string(),
    hair: hairDynamics.optional(),
    hairPieces: z.array(contentRef('figure-hair')).min(1).optional(),
    stand: contentRef('figure-stand').optional(),
    rig: contentRef('figure-rig').optional(),
  })
  .superRefine((figure, ctx) => {
    if (!Object.hasOwn(figure.outfits, figure.default)) {
      const names = Object.keys(figure.outfits).sort().join(', ')
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: `no outfit ${figure.default} (outfits: ${names})`,
      })
    }
    // A hair garment with no style wears the figure's hairPieces (M3.5b decision 6), so it needs some.
    if (!figure.hairPieces?.length)
      for (const [name, garments] of Object.entries(figure.outfits))
        garments.forEach((garment, index) => {
          if ('hair' in garment && garment.style === undefined)
            ctx.addIssue({
              code: 'custom',
              path: ['outfits', name, index, 'hair'],
              message: "a hair garment with no style wears the figure's hairPieces, and this figure has none",
            })
        })
    // The generator never runs at boot on a skeleton it cannot build (§6): it is refused here, at the slider.
    for (const problem of skeletonProblems(figure)) {
      ctx.addIssue({ code: 'custom', path: [...problem.path], message: problem.message })
    }
  })
