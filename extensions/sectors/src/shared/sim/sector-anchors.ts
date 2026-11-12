import type { AfSector2 } from '@automata/3d/level'

// Where a cutscene's anchors stand in a 3D room. The only anchor a room has is `actor:<id>`: a person placed in the level
// (its `cast`), at the point the level editor put them. A script that starts its actor at `actor:keeper` starts it where
// the room has the keeper, so moving the keeper in the room moves the scene with them.

/** The point of an anchor in metres, or undefined when the room lacks it. Pass it to `placeScript`. */
export type SectorAnchorOf = (anchor: string) => { readonly x: number; readonly z: number } | undefined

/** The anchors of `level`'s cast, by the id after `actor:`. */
export function sectorAnchors(level: AfSector2): SectorAnchorOf {
  const placed = new Map<string, { readonly x: number; readonly z: number }>()
  for (const person of level.cast ?? []) {
    const [x, z] = person.at
    if (x !== undefined && z !== undefined) placed.set(person.id, { x, z })
  }
  return (anchor) => (anchor.startsWith('actor:') ? placed.get(anchor.slice('actor:'.length)) : undefined)
}
