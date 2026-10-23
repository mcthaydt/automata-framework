import type { PatternCell, Rule } from '../../../tiles/autotile/rule.schema'

// The terrain rules the templates ship (2D editor spec §7): one rule per neighbourhood a solid cell can tell apart, so
// ground, walls and walls' corners draw themselves from an IntGrid. Both sets read a 3 × 3 window around the cell
// (row-major: NW N NE / W C E / SW S SE), are exclusive (exactly one rule matches any neighbourhood, which the tests
// prove) and read beyond the level edge as the cell itself, so a wall runs on past the edge instead of ending in one.

export interface TerrainRuleOptions {
  /** The IntGrid value that is solid. */
  readonly value: number
  /** The tile index of the first rule; the set takes consecutive indices from it. */
  readonly firstTile: number
  /** Rule ids are `<prefix>-<neighbours that are solid>`, for example `ground-n-e-ne`. */
  readonly idPrefix: string
}

/** The four edge neighbours, clockwise from north, with their place in the 3 × 3 pattern. */
const EDGES = [
  { name: 'n', at: 1 },
  { name: 'e', at: 5 },
  { name: 's', at: 7 },
  { name: 'w', at: 3 },
] as const

/** The four diagonals, clockwise from north-east, each between the two edges (indices into `EDGES`) that touch it. */
const CORNERS = [
  { name: 'ne', at: 2, between: [0, 1] },
  { name: 'se', at: 8, between: [1, 2] },
  { name: 'sw', at: 6, between: [2, 3] },
  { name: 'nw', at: 0, between: [3, 0] },
] as const

interface Terrain {
  readonly names: string[]
  readonly pattern: PatternCell[]
}

/** A pattern from the solid edges and the solid diagonals among `corners`; a diagonal not listed is not read. */
function terrain(
  value: number,
  edgeMask: number,
  corners: readonly (typeof CORNERS)[number][],
  cornerBits: number,
): Terrain {
  const pattern: PatternCell[] = Array.from({ length: 9 }, () => 'any' as const)
  const names: string[] = []
  pattern[4] = { is: value }
  EDGES.forEach((edge, index) => {
    const solid = ((edgeMask >> index) & 1) === 1
    pattern[edge.at] = solid ? { is: value } : { not: value }
    if (solid) names.push(edge.name)
  })
  corners.forEach((corner, index) => {
    const solid = ((cornerBits >> index) & 1) === 1
    pattern[corner.at] = solid ? { is: value } : { not: value }
    if (solid) names.push(corner.name)
  })
  return { names, pattern }
}

function terrainRule(options: TerrainRuleOptions, tile: number, found: Terrain): Rule {
  return {
    id: `${options.idPrefix}-${found.names.length === 0 ? 'alone' : found.names.join('-')}`,
    active: true,
    size: 3,
    pattern: found.pattern,
    tiles: [tile],
    chance: 1,
    flipX: false,
    flipY: false,
    breakOnMatch: true,
    outside: 'same',
  }
}

/**
 * The 47-tile blob set. A diagonal only matters when both edges beside it are solid (otherwise the edges already say
 * how the corner looks), so the cases are 1 + 4 + 8 + 2 + 16 + 16 = 47. Tiles are numbered in a fixed order: by the
 * edges present (north 1, east 2, south 4, west 8), then by the diagonals that matter (in clockwise order, as bits).
 * The first is the isolated cell and the last the cell inside a solid mass.
 */
export function blobRules(options: TerrainRuleOptions): Rule[] {
  const rules: Rule[] = []
  for (let edgeMask = 0; edgeMask < 16; edgeMask++) {
    const mattering = CORNERS.filter((corner) =>
      corner.between.every((edge) => ((edgeMask >> edge) & 1) === 1),
    )
    for (let cornerBits = 0; cornerBits < 1 << mattering.length; cornerBits++) {
      const tile = options.firstTile + rules.length
      rules.push(terrainRule(options, tile, terrain(options.value, edgeMask, mattering, cornerBits)))
    }
  }
  return rules
}

/** The 16-tile set that reads only the four edges: tile `firstTile + north + 2 east + 4 south + 8 west`. */
export function edgeRules(options: TerrainRuleOptions): Rule[] {
  const rules: Rule[] = []
  for (let edgeMask = 0; edgeMask < 16; edgeMask++) {
    rules.push(terrainRule(options, options.firstTile + edgeMask, terrain(options.value, edgeMask, [], 0)))
  }
  return rules
}
