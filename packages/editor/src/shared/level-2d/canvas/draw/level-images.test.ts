import { describe, expect, it } from 'vitest'
import { richProject } from '../../../../testing/level-2d/draw-fixtures'
import { withDefs } from '../../../../testing/level-2d/project-edit'
import { levelImages } from './level-images'

// The images a level may draw (ED2D.4c3b): what the texture manager loads before the draw list is built.

describe('levelImages', () => {
  it('lists the level’s background image', () => {
    expect(levelImages(richProject(), 'cellar')).toEqual(['art/cellar.png'])
    expect(levelImages(richProject(), 'start')).toEqual([])
  })

  it('lists every tileset image once, sorted, with the background', () => {
    const project = withDefs(richProject(), (defs) => {
      const [terrain] = defs.tilesets
      if (terrain === undefined) throw new Error('the rich fixture has a tileset')
      return {
        ...defs,
        tilesets: [
          { ...terrain, image: 'assets/terrain.png' },
          { ...terrain, id: 'b', image: 'art/cellar.png' },
          { ...terrain, id: 'c', image: 'assets/a.png' },
          { ...terrain, id: 'd' },
        ],
      }
    })
    expect(levelImages(project, 'cellar')).toEqual(['art/cellar.png', 'assets/a.png', 'assets/terrain.png'])
  })

  it('refuses a level that is not there', () => {
    expect(() => levelImages(richProject(), 'nowhere')).toThrow(RangeError)
  })
})
