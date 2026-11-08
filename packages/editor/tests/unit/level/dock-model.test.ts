import { describe, expect, it } from 'vitest'
import { levelCards } from '#src/features/level/dock-model.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { addLevel, findLevel } from '#src/shared/level-2d/model/world/level-edits.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

describe('levelCards', () => {
  it("lists the world's levels in its order with the current one marked", () => {
    const project = platformerTemplate.create(counterIds())
    const world = project.worlds[0]?.id ?? ''
    const first = findLevel(project, 'level-1')
    const two = addLevel(project, {
      id: 'level-2',
      name: 'Level 2',
      size: { w: 256, h: 144 },
      world,
      x: 512,
      y: 0,
    })
    expect(levelCards(two, world, 'level-2')).toEqual([
      { id: 'level-1', name: first.name, size: first.size, current: false },
      { id: 'level-2', name: 'Level 2', size: { w: 256, h: 144 }, current: true },
    ])
  })

  it('refuses a world the project does not have', () => {
    expect(() => levelCards(platformerTemplate.create(counterIds()), 'nowhere', 'level-1')).toThrow(
      RangeError,
    )
  })
})
