import { Grid } from '../../shared/level-2d/model/grid'
import type { Project, TilesetDef } from '../../shared/level-2d/model/project-types'
import { type AutoTiles, autoTiles } from '../../shared/level-2d/tiles/autotile/auto-tiles'
import { compileRules } from '../../shared/level-2d/tiles/autotile/match'
import { autoLayersOf } from './tilesets-model'

// The Tilesets view's live preview: a
// fixed sample IntGrid painted with the chosen value, what the auto layer's rules make of it through the same engine a
// level uses, and the cells where the selected rule matches when it is evaluated alone. Cells beyond the sample read as
// each rule's `outside`, as at a level's edge.

export const SAMPLE = { cols: 12, rows: 8 } as const

/** A platform with a step, a hole and a lone cell: every edge, corner and inner corner a terrain set draws shows. */
const SHAPE = [
  '............',
  '.###....#...',
  '.####.......',
  '.####...###.',
  '.##.#...###.',
  '.####.######',
  '############',
  '############',
]

export function sampleGrid(value: number): Grid {
  return Grid.empty(SAMPLE.cols, SAMPLE.rows).edit((cells) => {
    SHAPE.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.set(x, y, value)
    })
  })
}

export interface RulePreview {
  readonly source: Grid
  readonly result: AutoTiles
  /** `y * cols + x` of each sample cell the selected rule matches, row by row. */
  readonly matched: readonly number[]
  readonly tileset: TilesetDef | undefined
  readonly seed: number
}

/** The seed the first level holding the layer rolls with, so the preview's variants are that level's. */
function seedOf(project: Project, layer: string): number {
  for (const level of project.levels) {
    const instance = level.layers.find((each) => each.def === layer)
    if (instance?.kind === 'auto') return instance.seed
  }
  return 0
}

export function rulePreview(project: Project, layer: string, value: number, rule?: string): RulePreview {
  const source = sampleGrid(value)
  const def = autoLayersOf(project).find((each) => each.id === layer)
  const seed = seedOf(project, layer)
  if (def === undefined)
    return {
      source,
      result: autoTiles(source, compileRules([]), seed),
      matched: [],
      tileset: undefined,
      seed,
    }
  const result = autoTiles(source, compileRules(def.groups), seed)
  const selected = def.groups.flatMap((group) => group.rules).find((each) => each.id === rule)
  const matched =
    selected === undefined
      ? []
      : [
          ...autoTiles(
            source,
            compileRules([
              { id: 'selected', label: '', active: true, rules: [{ ...selected, active: true, tiles: [0] }] },
            ]),
            seed,
          ).stacks.keys(),
        ].sort((a, b) => a - b)
  return {
    source,
    result,
    matched,
    tileset: project.defs.tilesets.find((set) => set.id === def.tileset),
    seed,
  }
}
