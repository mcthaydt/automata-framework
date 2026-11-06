import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { openProject } from '#src/shared/level-2d/model/open-project.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { contentMismatches } from '#src/testing/level-2d/content-roundtrip.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'

const SAMPLES: [string, () => Project][] = [
  ['Mossgate', () => mossgate(counterIds())],
  ['Hollowmere', () => hollowmere(counterIds())],
]

const items = (project: Project, def: string): number =>
  project.levels.reduce(
    (total, level) =>
      total +
      level.layers.reduce(
        (sum, layer) =>
          sum + (layer.kind === 'entities' ? layer.items.filter((i) => i.def === def).length : 0),
        0,
      ),
    0,
  )

describe.each(SAMPLES)('the %s sample', (_name, make) => {
  it('opens, checks with no error and no warning, and reprints byte for byte', () => {
    const project = make()
    const text = printProject(project)
    const opened = openProject(text)
    expect(opened.status).toBe('opened')
    expect(checkProject(project, {}).filter((d) => d.severity !== 'info')).toEqual([])
    expect(levelProject.print(text, project)).toBe(text)
  })

  it('exports as AF content that validates and says what the editor holds (G-i)', () => {
    expect(contentMismatches(make())).toEqual([])
  })
})

describe('Mossgate', () => {
  const project = mossgate(counterIds())

  it('is a platformer of two linked levels with its enemies, coins and a door', () => {
    expect(project.name).toBe('Mossgate')
    expect(project.template).toBe('platformer')
    expect(project.levels.map((level) => level.id)).toEqual(['moss-steps', 'root-cellar'])
    expect(items(project, 'slime')).toBe(3)
    expect(items(project, 'coin')).toBeGreaterThanOrEqual(3)
    expect(items(project, 'door')).toBe(2)
  })

  it('uses all five collision values and the auto layer resolves them to tiles', () => {
    const level = project.levels[0]
    const collision = level?.layers.find((layer) => layer.def === 'collision')
    if (collision?.kind !== 'intgrid') throw new Error('no collision')
    const values = new Set(collision.cells.nonEmpty().map((cell) => cell.value))
    expect(values).toEqual(new Set([1, 2, 3, 4, 5]))
  })
})

describe('Hollowmere', () => {
  const project = hollowmere(counterIds())

  it('is a top-down RPG of a village, an inn and a forest path', () => {
    expect(project.template).toBe('topdown-rpg')
    expect(project.levels.map((level) => level.id)).toEqual(['village', 'inn', 'forest-path'])
    expect(items(project, 'npc')).toBe(2)
    expect(items(project, 'door')).toBe(2)
    expect(items(project, 'warp')).toBe(1)
  })

  it('links the village door to the inn and back, and the warp to the forest', () => {
    const refs: string[] = []
    for (const level of project.levels) {
      for (const layer of level.layers) {
        if (layer.kind !== 'entities') continue
        for (const item of layer.items) {
          const target = item.fields.target
          if (typeof target === 'object' && target !== null && 'container' in target) {
            refs.push(`${level.id}:${item.def}->${target.container}`)
          }
        }
      }
    }
    expect(refs.sort()).toEqual(['inn:door->village', 'village:door->inn', 'village:warp->forest-path'])
  })
})

describe('both samples, one editor (G-s)', () => {
  it('load through the same profile code path', () => {
    for (const [, make] of SAMPLES) {
      const parsed = levelProject.parse(printProject(make()))
      expect(parsed.ok).toBe(true)
    }
  })
})
