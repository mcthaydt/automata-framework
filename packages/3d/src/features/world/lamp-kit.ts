// The lamp kit: a lamp names a kind, and the kind sets its colour, how far it reaches and how bright it may get. A lamp
// may carry its own colour (a lamp is rarely the exact white of its kind) but only within `tone` of the kind's in
// OKLab, so one level's lamps read as one set of lights; a neon is a coloured glow (a tube, a screen, a headlight), so
// it may be any colour.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/paint/look.ts at 6d82a52 (`lampIssues`,
// `resolveLamp`) and library/look.json's `kit` and `tone`. The rest of that file's look is the renderer's
// (`shared/render/light`). Changed: a bad lamp is a `LevelProblem`-shaped fault the builder reports, not a throw.

import type { LampPlace } from '../../shared/level/af-sector-2.schema.ts'
import { hexToRgb, labDistance } from '../../shared/math/colour.ts'
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
