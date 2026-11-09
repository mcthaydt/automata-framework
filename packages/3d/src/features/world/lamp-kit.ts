// The lamp kit: a lamp names a kind, and the kind sets its colour, how far it reaches and how bright it may get. A lamp
// may carry its own colour (a lamp is rarely the exact white of its kind) but only within `tone` of the kind's in OKLab,
// so one level's lamps read as one set of lights; a neon is a coloured glow (a tube, a screen, a headlight), so it may
// be any colour. The rest of that file's look is the renderer's (`shared/render/light`). Changed: a bad lamp is a
// `LevelProblem`-shaped fault the builder reports, not a throw.

import type { LampPlace } from '../../shared/level/af-sector-2.schema.ts'
import { hexToRgb, labDistance, oklab, rgbFromLab } from '../../shared/math/colour.ts'
import kit from './library/lamp-kit.json' with { type: 'json' }

interface Kind {
  readonly color: string
  readonly range: readonly [number, number]
  readonly peak: number
  /** Lit only at night: a street lamp on its photocell. */
  readonly dusk?: boolean
}

export const LAMP_KINDS: Readonly<Record<string, Kind>> = kit.kit as unknown as Record<string, Kind>

/** A lamp resolved against its kind. */
export interface ResolvedLamp {
  /** `0xRRGGBB`. */
  readonly color: number
  /** Metres: clamped into the kind's band, the band's middle when the lamp names none. */
  readonly range: number
  /** Authored level (1 unless it names one), held at the kind's peak. */
  readonly level: number
  readonly peak: number
  readonly dusk: boolean
}

/** Why a lamp breaks the kit, or undefined when it does not: an unknown kind, or a colour off the kind's tone. */
export function lampFault(
  lamp: Pick<LampPlace, 'kind' | 'color'>,
): { readonly code: 'unknown-lamp-kind' | 'lamp-off-tone'; readonly message: string } | undefined {
  const kind = LAMP_KINDS[lamp.kind]
  if (kind === undefined)
    return {
      code: 'unknown-lamp-kind',
      message: `there is no lamp kind "${lamp.kind}" (${Object.keys(LAMP_KINDS).join(', ')})`,
    }
  if (lamp.kind !== 'neon' && lamp.color !== undefined) {
    const distance = labDistance(hexToRgb(lamp.color), hexToRgb(kind.color))
    if (distance > kit.tone)
      return {
        code: 'lamp-off-tone',
        message: `colour ${lamp.color} is off the ${lamp.kind} tone ${kind.color} (${distance.toFixed(3)} apart, ${kit.tone} allowed)`,
      }
  }
  return undefined
}

/** A lamp against its kind: its colour (its own, or the kind's), range and level. The kind must be known. */
export function resolveLamp(lamp: Pick<LampPlace, 'kind' | 'color' | 'range' | 'level'>): ResolvedLamp {
  const kind = LAMP_KINDS[lamp.kind] as Kind
  const [low, high] = kind.range
  return {
    color: hexToRgb(lamp.color ?? kind.color),
    range: lamp.range === undefined ? (low + high) / 2 : Math.min(high, Math.max(low, lamp.range)),
    level: Math.min(lamp.level ?? 1, kind.peak),
    peak: kind.peak,
    dusk: kind.dusk === true,
  }
}

const hex = (rgb: number): string => `#${rgb.toString(16).padStart(6, '0')}`

/**
 * The colour a lamp of `kind` is drawn in: the kind's, or `wanted` when it is within tone of it, else `wanted` moved toward
 * the kind's along the straight line in OKLab until it is. A neon takes any colour. A kind the kit lacks has none.
 */
export function lampColour(kind: string, wanted?: string): string {
  const known = LAMP_KINDS[kind]
  if (known === undefined)
    throw new Error(`there is no lamp kind "${kind}" (${Object.keys(LAMP_KINDS).join(', ')})`)
  if (wanted === undefined) return known.color
  if (kind === 'neon' || labDistance(hexToRgb(wanted), hexToRgb(known.color)) <= kit.tone) return wanted
  const [l0, a0, b0] = oklab(hexToRgb(known.color))
  const [l1, a1, b1] = oklab(hexToRgb(wanted))
  // Rounding to bytes can push the colour a hair past the tone, so the reach shrinks until it is not.
  for (let share = 0.98; share > 0; share -= 0.05) {
    const t = (kit.tone / labDistance(hexToRgb(wanted), hexToRgb(known.color))) * share
    const made = hex(rgbFromLab(l0 + (l1 - l0) * t, a0 + (a1 - a0) * t, b0 + (b1 - b0) * t))
    if (labDistance(hexToRgb(made), hexToRgb(known.color)) <= kit.tone) return made
  }
  return known.color
}
