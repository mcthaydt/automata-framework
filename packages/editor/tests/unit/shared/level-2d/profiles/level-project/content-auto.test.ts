import { levelContentSchema } from '@automataframework/automata-content/level-2d'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { decodeRows, packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { Grid } from '#src/shared/level-2d/model/grid.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { exportContent } from '#src/shared/level-2d/profiles/level-project/content-export.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { engineStack } from '#src/testing/level-2d/content-roundtrip.ts'
import { withDefs, withLayer } from '#src/testing/level-2d/project-edit.ts'
import { makeGroup, makeRule } from '#src/testing/level-2d/rules.ts'

/** A platformer whose collision has a hill: a floor with a two-cell step. */
function hill(): Project {
  const project = platformerTemplate.create(counterIds())
  return withLayer(project, 'level-1', 'collision', (layer) =>
    layer.kind === 'intgrid'
      ? { ...layer, cells: layer.cells.fillRect(8, 14, 6, 2, 1).fillRect(10, 12, 2, 2, 1) }
      : layer,
  )
}

function exportedStack(project: Project): Grid[] {
  const file = exportContent(project).find((f) => f.path === 'levels/level-1.toml')
  const level = levelContentSchema.parse(parse(file?.contents ?? ''))
  const layer = level.layers.find((l) => l.def === 'ground')
  if (layer?.kind !== 'auto') throw new Error('no auto layer')
  return layer.stack.map((depth) => {
    const decoded = decodeRows(depth.rows, 'tile', 32, 18)
    if (!decoded.ok) throw new Error(JSON.stringify(decoded.problems))
    return decoded.grid
  })
}

/** The editor's own result for the ground layer as one grid per stack depth. */
function expectedStack(project: Project): Grid[] {
  const level = project.levels[0]
  if (level === undefined) throw new Error('no level')
  return engineStack(project, level, 'ground')
}

const same = (a: readonly Grid[], b: readonly Grid[]): boolean =>
  a.length === b.length && a.every((grid, i) => grid.equals(b[i] as Grid))

describe('an auto layer in the export', () => {
  it('is written as resolved tile grids, one per stack depth, equal to the editor result', () => {
    const project = hill()
    const written = exportedStack(project)
    expect(written.length).toBeGreaterThan(0)
    expect(written[0]?.nonEmpty().length).toBeGreaterThan(0)
    expect(same(written, expectedStack(project))).toBe(true)
  })

  it('has one grid per depth, so a cell that several rules draw on is split across them', () => {
    const project = withDefs(hill(), (defs) => ({
      ...defs,
      layers: defs.layers.map((layer) =>
        layer.kind === 'auto'
          ? {
              ...layer,
              groups: [
                makeGroup('base', [makeRule('fill', ['1'], { tiles: [5] })]),
                makeGroup('shine', [makeRule('shine', ['1'], { tiles: [9] })]),
              ],
            }
          : layer,
      ),
    }))
    const written = exportedStack(project)
    expect(written).toHaveLength(2)
    const cell = written[0]?.nonEmpty()[0]
    expect(cell && written[1]?.get(cell.x, cell.y)).toBe(packTile(9, false, false))
    expect(same(written, expectedStack(project))).toBe(true)
  })

  it('has the manual tiles on top: an override replaces the whole stack of its cell', () => {
    const project = withLayer(hill(), 'level-1', 'ground', (layer) =>
      layer.kind === 'auto'
        ? { ...layer, overrides: layer.overrides.set(8, 14, packTile(50, true, false)) }
        : layer,
    )
    const written = exportedStack(project)
    expect(written[0]?.get(8, 14)).toBe(packTile(50, true, false))
    for (const depth of written.slice(1)) expect(depth.get(8, 14)).toBe(0)
    expect(same(written, expectedStack(project))).toBe(true)
  })

  it('uses the layer seed, so variation is what the editor shows', () => {
    const varied = (seed: number): Project =>
      withLayer(
        withDefs(hill(), (defs) => ({
          ...defs,
          layers: defs.layers.map((layer) =>
            layer.kind === 'auto'
              ? {
                  ...layer,
                  groups: [makeGroup('v', [makeRule('v', ['1'], { tiles: [1, 2, 3], chance: 0.5 })])],
                }
              : layer,
          ),
        })),
        'level-1',
        'ground',
        (layer) => (layer.kind === 'auto' ? { ...layer, seed } : layer),
      )
    expect(same(exportedStack(varied(5)), expectedStack(varied(5)))).toBe(true)
    expect(same(exportedStack(varied(5)), exportedStack(varied(6)))).toBe(false)
  })

  it('has an empty stack when there is no ground', () => {
    expect(exportedStack(platformerTemplate.create(counterIds())).length).toBeGreaterThan(0)
    const bare = withLayer(platformerTemplate.create(counterIds()), 'level-1', 'collision', (layer) =>
      layer.kind === 'intgrid' ? { ...layer, cells: Grid.empty(layer.cells.cols, layer.cells.rows) } : layer,
    )
    expect(exportedStack(bare)).toEqual([])
  })
})
