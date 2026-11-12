// A swatch's ladder: its ramp's eight DUEL steps dark to light and the step it sits on. A texel's albedo is that base
// step plus the offset its texture or pattern gives it, clamped to the ladder; a photo-mode texel carries its own colour,
// so it moves along its own ramp as any texel moves along its swatch's.
import { DUEL_RAMP_NAMES, DUEL_RAMPS, type DuelRampName } from '@automataframework/content/palette'

export const STEPS = 8

/** What a swatch needs of itself to have a ladder: a ramp (by name or row) and the step it sits on. */
export interface LadderSwatch {
  readonly ramp: DuelRampName | number
  readonly step: number
}

export interface Ladder {
  /** The ramp's row, 0 to 31. */
  readonly ramp: number
  /** Its eight steps as `0xRRGGBB`, dark to light. */
  readonly steps: readonly number[]
  readonly base: number
}

const rampRow = (ramp: DuelRampName | number): number =>
  typeof ramp === 'number' ? ramp : DUEL_RAMP_NAMES.indexOf(ramp)

const cache = new Map<string, Ladder>()

/** The swatch's ladder (cached by ramp and step). */
export function ladderOf(swatch: LadderSwatch): Ladder {
  const ramp = rampRow(swatch.ramp)
  const key = `${ramp}:${swatch.step}`
  let hit = cache.get(key)
  if (hit === undefined) {
    const row = DUEL_RAMPS[ramp]
    if (row === undefined) throw new RangeError(`no DUEL ramp ${String(swatch.ramp)}`)
    hit = { ramp, steps: row.map((h) => Number.parseInt(h.slice(1), 16)), base: swatch.step }
    cache.set(key, hit)
  }
  return hit
}

/** The swatch moved onto DUEL ramp `ramp`: a photo-mode texel's own colour, every other rule the swatch's. */
export const onRamp = (swatch: LadderSwatch, ramp: number): LadderSwatch => ({ ramp, step: swatch.step })

/** A lit surface's albedo step (0 to 7): the swatch's base and the texel's offset. */
export const albedoStep = (base: number, offset: number): number =>
  Math.max(0, Math.min(STEPS - 1, base + offset))

/** A palette index (ramp × 8 + step) as `0xRRGGBB`. */
export function paletteRgb(index: number): number {
  const hex = DUEL_RAMPS[index >> 3]?.[index & 7]
  if (hex === undefined) throw new RangeError(`no palette index ${index}`)
  return Number.parseInt(hex.slice(1), 16)
}
