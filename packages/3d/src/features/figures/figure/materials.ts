// A built figure's materials: every name a part or a decal carries, as a palette colour (M3 spec §4.4.1,
// amended 2026-10-30: materials name palette colours). A name is a library swatch's id, or a variant of one
// (`<swatch>@<role>`): where FigureBuilder makes a painter material out of a swatch (a rib's matte knit, a
// lining in shadow, a stitch in the cloth's light, a flap a tone lighter, the hair's lit strands), AF keeps
// the swatch's palette colour and records the change for the view, a tone step (`shade`), unlit (`flat`), or
// no gloss (`matte`). New here; it replaces FigureBuilder's DUEL ramp tones (`paintOf`, `own`, `lighter`,
// `mark`, `flatTone`, hair.ts `finish`, the ears' and a cap seam's tones; src/render/figure at a1f7246).

import { type Swatch, swatchColour } from '../content/swatch.schema.ts'

/** A material as the view draws it. */
export interface BuiltMaterial {
  /** A 0-based index into the game's palette (DUEL by default). */
  readonly colour: number
  /** 0–1: how glossy (hair, shoes, buckles). */
  readonly gloss?: number
  /** Unlit: it keeps its colour in any light (marks, stitches, soles). */
  readonly flat?: boolean
  /**
   * A tone step from the lit colour: +1 a step lighter, −1 the shadow, −2 the deep (the source's four tones).
   */
  readonly shade?: number
}

/** A swatch worn differently: a tone step, unlit, without its gloss, or with a gloss of its own. */
export interface Variant {
  readonly shade?: number
  readonly flat?: boolean
  readonly matte?: boolean
  readonly gloss?: number
}

/** The variants an outfit makes as it is built, by name, each with the swatch it is made from. */
export type Made = Record<string, Variant & { readonly of: string }>

/** A variant's fields in a fixed order, to compare two registrations. */
const key = (v: Variant & { readonly of: string }): string =>
  JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))

/**
 * Registers `<of>@<role>` and returns its name. A name means one material: registering it again with another
 * change is refused (a role name used by two garments for two tones is a bug, not a choice between them).
 */
export function variant(made: Made, of: string, role: string, change: Variant): string {
  const name = `${of}@${role}`
  const wanted = { of, ...change }
  const known = made[name]
  if (known === undefined) made[name] = wanted
  else if (key(known) !== key(wanted))
    throw new Error(`${name} is made twice: ${JSON.stringify(known)} and ${JSON.stringify(wanted)}`)
  return name
}

const fromSwatch = (s: Swatch): BuiltMaterial => ({
  colour: swatchColour(s),
  ...(s.gloss !== undefined ? { gloss: s.gloss } : {}),
  ...(s.flat ? { flat: true } : {}),
})

/** Each name as a palette colour; a name that is neither a swatch nor a variant of one is refused. */
export function resolveMaterials(
  names: Iterable<string>,
  made: Made,
  swatches: Readonly<Record<string, Swatch>>,
): Record<string, BuiltMaterial> {
  const swatchOf = (name: string): Swatch => {
    const found = swatches[name]
    if (found === undefined) throw new Error(`no swatch ${name}`)
    return found
  }
  const out: Record<string, BuiltMaterial> = {}
  for (const name of [...new Set(names)].sort()) {
    const made_ = made[name]
    if (made_ === undefined) {
      out[name] = fromSwatch(swatchOf(name))
      continue
    }
    const base = fromSwatch(swatchOf(made_.of))
    const gloss = made_.gloss ?? (made_.matte ? undefined : base.gloss)
    const flat = made_.flat ?? base.flat
    out[name] = {
      colour: base.colour,
      ...(gloss !== undefined ? { gloss } : {}),
      ...(flat ? { flat: true } : {}),
      ...(made_.shade ? { shade: made_.shade } : {}),
    }
  }
  return out
}
