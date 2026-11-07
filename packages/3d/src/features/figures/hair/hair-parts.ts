// Hair styles as parts: a style is a list of pieces fitted to the skull in head units (angles round it from
// the front, + toward the figure's left and mirrored; heights of its half-height about its middle; sizes of
// its half-width), so any head the sliders make wears it. Core builds none of them: a piece kind (a scalp, rows, a
// tail, a fall, a bun, a sweep, a block, edges) is registered with `registerHairPiece` by the character kit, and this
// file hands each entry of a style to the one registered under its key. What a piece shares is `HairBuild`.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`HairInput`,
// `hairParts`), with AF's strict types; the formulas and their order are the source's. Changed: a piece's
// tone is a swatch variant (tones.ts) instead of a painter ramp; the texel sizes are held at the fixed ppm; the
// piece builders left for @automata/character-kit.

import type { V3 } from '../../../shared/math/math.ts'
import type { Measure } from '../body/genes.ts'
import type { Decal, Mesh, Part, Weight } from '../body/mesh.ts'
import { at, J, type Skeleton } from '../body/rig.ts'
import type { HairStyle, Piece } from '../content/hair.schema.ts'
import type { Made } from '../figure/materials.ts'
import { headForm } from '../outfit/garments/head.ts'
import { hairPieceOf } from '../registry/hair-piece-registry.ts'
import { CROWN, HAIR_SEAM, type Skull, skull } from './skull.ts'
import { type Finish, toneOf } from './tones.ts'

export interface HairInput {
  m: Measure
  s: Skeleton
  /** The hair's swatch, and the skin's (a fade and the scalp take its colour). */
  hair: string
  skin: string
  made: Made
  /** Under a cap. */
  capped?: boolean
  /** The wearer's tie (a swatch): the outfit's metal, or one it names. */
  tie?: string | undefined
  /** The dressed trunk (its tops and the body's torso, rest figure space): what a tail falls clear of. */
  trunk?: readonly Part[]
}

/**
 * What a style's pieces share as they are built: the head's frame, the parts so far, and how to tone and bind
 * them.
 */
export interface HairBuild {
  readonly input: HairInput
  readonly k: Skull
  readonly form: ReturnType<typeof headForm>
  readonly head: V3
  readonly hw: number
  readonly parts: Part[]
  readonly decals: Decal[]
  /** A material for a tone in the style's finish. */
  tone(t: string, matte?: boolean): string
  /** A tie's swatch: the style's own, or the wearer's (true), else a band in the hair's own lit tone. */
  tieOf(t: boolean | string | undefined): string | null
  /** A fresh seam: a rope whose gaps must show is its own surface. */
  nextSeam(): number
  /** A rigid piece on the head. */
  rigid(mesh: Mesh, t: string, own?: number, lit?: Mesh, matte?: boolean): void
  /** A skinned piece: its points in head space, each carried by `swing` of its share along. */
  hung(
    mesh: Mesh,
    ts: readonly number[],
    to: string,
    swing: (t: number) => Weight[],
    own: number,
    lit?: Mesh,
    matte?: boolean,
  ): void
}

/**
 * A style's parts on the head and its swinging joints, fitted to the skeleton's head and the body under it.
 */
export function hairParts(input: HairInput, style: HairStyle): { parts: Part[]; decals: Decal[] } {
  const { s, m } = input
  const k = skull(s)
  const form = headForm(m, s)
  const head = at(s.rest, J.head)
  const hw = k.r[0]
  const parts: Part[] = []
  const decals: Decal[] = []
  const finish: Finish = style.finish ?? 'straight'
  let seam = HAIR_SEAM + 100
  const b: HairBuild = {
    input,
    k,
    form,
    head,
    hw,
    parts,
    decals,
    tone: (t, matte) => toneOf(input.made, input.hair, input.skin, finish, t, matte),
    tieOf: (t) => (!t ? null : typeof t === 'string' ? t : (input.tie ?? b.tone('lit'))),
    nextSeam: () => seam++,
    rigid: (mesh, t, own = HAIR_SEAM, lit, matte) => {
      parts.push({ bone: J.head, mesh, material: b.tone(t, matte), group: 1, seam: own })
      if (lit) parts.push({ bone: J.head, mesh: lit, material: b.tone('lit', matte), group: 1, seam: own })
    },
    hung: (mesh, ts, to, swing, own, lit, matte) => {
      const meshes: [Mesh, string][] = [[mesh, to], ...(lit ? [[lit, 'lit'] as [Mesh, string]] : [])]
      for (const [m_, t] of meshes) {
        const placed = { ...m_, positions: m_.positions.map((v, n) => v + at(head, n % 3)) }
        parts.push({ mesh: placed, material: b.tone(t, matte), group: 1, seam: own, skin: ts.map(swing) })
      }
    },
  }
  for (const piece of style.pieces ?? []) {
    const first = parts.length
    buildPiece(b, piece)
    // The hair's top over the crown (a piece that asks for it: a shell, rows, a bun; never a lock hanging off it):
    // what is worn up lies on it, not on whatever stands furthest out.
    if (registered(piece)?.[1].crown)
      for (let n = first; n < parts.length; n++) parts[n] = { ...at(parts, n), tag: CROWN }
  }
  return { parts, decals }
}

/** The registered piece (H3) a piece names, with its data, or undefined for one of the base generators. */
function registered(piece: Piece): [unknown, NonNullable<ReturnType<typeof hairPieceOf>>] | undefined {
  const [kind = ''] = Object.keys(piece)
  const found = hairPieceOf(kind)
  return found && [(piece as Record<string, unknown>)[kind], found]
}

/** Builds one entry of a style's `pieces` with the piece registered under its kind (H3). Core registers none. */
function buildPiece(b: HairBuild, piece: Piece): void {
  const found = registered(piece)
  if (!found) throw new RangeError(`There is no hair piece called "${Object.keys(piece)[0] ?? ''}"`)
  found[1].build(b, found[0])
}
