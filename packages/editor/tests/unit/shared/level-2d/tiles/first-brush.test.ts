import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { blankTemplate } from '#src/shared/level-2d/profiles/level-project/templates/blank.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import { firstBrush } from '#src/shared/level-2d/tiles/first-brush.ts'

// A new level opens ready to paint its ground, never on a character: the first tap makes a visible mark that is a
// floor or a wall, not a Player start or a zone the person did not ask for.

describe('firstBrush', () => {
  it('is the ground of the platformer: the first value of its first IntGrid layer', () => {
    expect(firstBrush(platformerTemplate.create(counterIds()))).toEqual({ layer: 'collision', word: 1 })
  })

  it('is a floor or wall value in the top-down template too, never an entities layer', () => {
    const project = topdownRpgTemplate.create(counterIds())
    const brush = firstBrush(project)
    const layer = project.defs.layers.find((def) => def.id === brush.layer)
    expect(layer?.kind).toBe('intgrid')
    expect(brush.word).toBeGreaterThan(0)
  })

  it('is the first tile of the first tiles layer when there is no IntGrid layer', () => {
    expect(firstBrush(blankTemplate.create(counterIds())).layer).toBe('tiles')
  })
})
