// A prop place into the generator that draws it and the parameters it draws with: the library preset's (`use`), then
// the place's own (`with`). A surface among the parameters (a swatch with its placement) is replaced by its tile's
// name, because the generators take swatch names; the placement is kept by that name for the pieces to carry.
import type { PropPlace } from '../../../shared/level/af-sector-2.schema.ts'
import { isSurfaceTex, type SurfaceTex } from '../surface.ts'
import type { WorldLibrary } from '../swatches.ts'
import type { Generator, Params } from './piece.ts'
import { propGenerator } from './prop-generator-registry.ts'

export interface ResolvedProp {
  readonly kind: string
  readonly generator: Generator
  readonly params: Params
  /** The placement of each tile a parameter named with one (the first, in key order, wins). */
  readonly placements: Readonly<Record<string, SurfaceTex>>
}

/** Why a prop could not be resolved: a code the checks report, and the name that was missing. */
export interface PropFault {
  readonly code: 'unknown-prop' | 'unknown-generator'
  readonly name: string
}

/** The kind of a place, its generator and its parameters; or what was missing. */
export function resolveProp(
  place: Pick<PropPlace, 'use' | 'kind' | 'with'>,
  library: WorldLibrary,
): ResolvedProp | PropFault {
  const preset = place.use === undefined ? undefined : library.props?.[place.use]
  if (place.use !== undefined && preset === undefined) return { code: 'unknown-prop', name: place.use }
  const kind = place.kind ?? (preset?.kind as string | undefined)
  const generator = kind === undefined ? undefined : propGenerator(kind)
  if (kind === undefined || generator === undefined) return { code: 'unknown-generator', name: kind ?? '' }
  const params: Params = { ...(preset ?? {}), ...(place.with ?? {}) }
  const placements: Record<string, SurfaceTex> = {}
  const named = (value: unknown): unknown => {
    if (!isSurfaceTex(value)) return value
    placements[value.tile] ??= value
    return value.tile
  }
  for (const [key, value] of Object.entries(params))
    params[key] = Array.isArray(value) ? value.map(named) : named(value)
  return { kind, generator, params, placements }
}

/** Whether `resolveProp` found nothing. */
export const isFault = (result: ResolvedProp | PropFault): result is PropFault => 'code' in result
