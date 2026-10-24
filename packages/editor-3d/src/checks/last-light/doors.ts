// Extracted from The Last Light scripts/pipeline/blockout-lib.ts `doors` (92e6704), the door half of its `openings`
// check: an opening's door is a door box, and straddles the opening's line, inside its span. The numbers and sentences
// are Last Light's; each problem also says where it is.
import type { Blockout } from '../../format/blockout.schema'
import type { Expanded } from '../../format/expand'
import { entitySelection, type Locator, locators, type Problem, place, sectorSelection } from '../check'

export function doorProblems(blockout: Blockout, expanded: Expanded): Problem[] {
  const problems: Problem[] = []
  for (const opening of blockout.openings ?? []) {
    if (!opening.door) continue
    const box = expanded.boxes.find((candidate) => candidate.id === opening.door)
    const throat = expanded.sectors.find((sector) => sector.id === opening.id)
    // The problem is in the opening: its connector, when the rooms stand apart and it has one. Where the rooms meet at one
    // wall there is no connector, and the door box is the only place to point at (with the box beside the connector).
    const doorBox: Locator | undefined = box
      ? place(() => entitySelection('box', box.id), { x: box.x, z: box.z })
      : undefined
    const connector = throat ? place(() => sectorSelection(opening.id)) : undefined
    const locator = connector ?? doorBox
    const related = connector ? locators(doorBox) : []
    if (box?.kind !== 'door') {
      problems.push({ message: `opening ${opening.id}: ${opening.door} is not a door box`, locator, related })
      continue
    }
    const mid = (opening.span[0] + opening.span[1]) / 2
    const inside = throat
      ? throat.corners.some(
          ([cx, cz]) => Math.abs(cx - box.x) <= box.w / 2 + 0.2 && Math.abs(cz - box.z) <= box.d / 2 + 0.2,
        )
      : true
    const along = Math.abs(box.x - mid) < 0.05 || Math.abs(box.z - mid) < 0.05
    if (!inside || !along)
      problems.push({
        message: `opening ${opening.id}: door ${opening.door} does not straddle it`,
        locator,
        related,
      })
  }
  return problems
}
