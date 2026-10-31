// The resolution of the map a sim holds. Resolving is pure, so it is computed once per map and kept beside it. It is
// keyed by the map's `sectors` array, which `loadSectorMap` replaces (the resource object itself stays the same), with
// the masses it was resolved with; a restored snapshot brings new arrays and resolves again to the same result.
// Nothing here is sim state.
import type { MassDef, SectorDef } from '@mcthaydt/automata-sector-format'
import type { SimContext } from '@mcthaydt/automata-sim'
import { type ResolvedMap, resolveMap } from './resolve'
import type { SectorMap } from './sector-map.schema'
import { SectorMapResource } from './sectors.resource'

const resolutions = new WeakMap<
  readonly SectorDef[],
  { readonly masses: readonly MassDef[] | undefined; readonly resolved: ResolvedMap }
>()

/** The resolved form of `map`, resolved the first time it is asked for. */
export function resolvedFor(map: SectorMap): ResolvedMap {
  const known = resolutions.get(map.sectors)
  if (known !== undefined && known.masses === map.masses) return known.resolved
  const resolved = resolveMap(map)
  resolutions.set(map.sectors, { masses: map.masses, resolved })
  return resolved
}

/** The resolved form of the scene's map, for this plugin's systems and for the plugins that read it (nav, systems). */
export const resolvedMap = (ctx: SimContext): ResolvedMap => resolvedFor(ctx.resource(SectorMapResource))
