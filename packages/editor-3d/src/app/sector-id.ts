// The id a new sector is given when nobody chose one (ED3D.6a, ED3D.6f): the Sector tool's drawn sector and the Split tool's
// new half both start with a name the inspector can change.

/**
 * `<prefix>N`, the lowest N from 1 that is not among the ids the level has taken: `sector-N` for a sector, and `<def>N`
 * for a thing of a definition (ED3D.7b).
 */
export function lowestFreeId(taken: readonly string[], prefix = 'sector-'): string {
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}${n}`)) return `${prefix}${n}`
}
