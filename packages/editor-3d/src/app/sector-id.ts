// The id a new sector is given when nobody chose one (ED3D.6a, ED3D.6f): the Sector tool's drawn sector and the Split tool's
// new half both start with a name the inspector can change.

/** `sector-N`, the lowest N that is not among the ids the level has taken. */
export function lowestFreeId(taken: readonly string[]): string {
  for (let n = 1; ; n++) if (!taken.includes(`sector-${n}`)) return `sector-${n}`
}
