import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { counterIds } from '../ids'
import type { Project, TilesetDef } from '../project-types'
import { addTileset, importTileset, tagTiles, untagTiles } from './tileset-edits'

const platformer = (): Project => platformerTemplate.create(counterIds())
const terrain = (p: Project): TilesetDef | undefined => p.defs.tilesets.find((set) => set.id === 'terrain')
const tagsOf = (p: Project, id = 'terrain'): TilesetDef['tags'] =>
  p.defs.tilesets.find((set) => set.id === id)?.tags ?? []
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => d.code)

const props: TilesetDef = {
  id: 'props',
  label: 'Props',
  image: 'art/props.png',
  imageSize: { w: 128, h: 64 },
  tile: { w: 16, h: 16 },
  spacing: 0,
  padding: 0,
  tags: [],
}

describe('addTileset', () => {
  it('appends a tileset with an image and a placeholder without one', () => {
    const { image: _image, ...placeholder } = props
    const project = platformer()
    const next = addTileset(addTileset(project, props), { ...placeholder, id: 'spare' })
    expect(next.defs.tilesets.map((set) => set.id)).toEqual(['terrain', 'props', 'spare'])
    expect(next.defs.tilesets[2]?.image).toBeUndefined()
    expect(next.levels).toBe(project.levels)
    expect(errors(next)).toEqual([])
  })

  it('refuses an id another tileset has and a shape the file schema refuses', () => {
    expect(() => addTileset(platformer(), { ...props, id: 'terrain' })).toThrow(/already/)
    expect(() => addTileset(platformer(), { ...props, id: 'Props' })).toThrow(RangeError)
    expect(() => addTileset(platformer(), { ...props, tile: { w: 0, h: 16 } })).toThrow(/tile/)
    expect(() => addTileset(platformer(), { ...props, image: '' })).toThrow(/image/)
  })

  it('refuses a tag on a tile the tileset does not have', () => {
    expect(() => addTileset(platformer(), { ...props, tags: [{ tag: 'rock', tiles: [32] }] })).toThrow(/32/)
  })
})

describe('importTileset', () => {
  it('swaps the image and its size and keeps every tile index and tag', () => {
    const project = platformer()
    const next = importTileset(project, 'terrain', { path: 'art/terrain.png', size: { w: 128, h: 128 } })
    expect(terrain(next)).toEqual({ ...terrain(project), image: 'art/terrain.png' })
    expect(next.levels).toBe(project.levels)
    expect(errors(next)).toEqual([])
  })

  it('records a new size, which the Checks then measure against', () => {
    const next = importTileset(platformer(), 'terrain', { path: 'art/big.png', size: { w: 256, h: 128 } })
    expect(terrain(next)?.imageSize).toEqual({ w: 256, h: 128 })
  })

  it('returns the same project for the image it already has', () => {
    const once = importTileset(platformer(), 'terrain', { path: 'art/terrain.png', size: { w: 128, h: 128 } })
    expect(importTileset(once, 'terrain', { path: 'art/terrain.png', size: { w: 128, h: 128 } })).toBe(once)
  })

  it('refuses an empty path, a size of nothing and a tileset that does not exist', () => {
    expect(() => importTileset(platformer(), 'terrain', { path: '', size: { w: 128, h: 128 } })).toThrow(
      RangeError,
    )
    expect(() => importTileset(platformer(), 'terrain', { path: 'a.png', size: { w: 0, h: 128 } })).toThrow(
      RangeError,
    )
    expect(() => importTileset(platformer(), 'nope', { path: 'a.png', size: { w: 8, h: 8 } })).toThrow(
      /no tileset "nope"/,
    )
  })
})

describe('tagTiles and untagTiles', () => {
  it('creates a tag with its tiles sorted and unique', () => {
    const next = tagTiles(platformer(), 'terrain', 'slippery', [60, 51, 60])
    expect(tagsOf(next).at(-1)).toEqual({ tag: 'slippery', tiles: [51, 60] })
  })

  it('merges tiles into a tag that exists, in place', () => {
    const next = tagTiles(platformer(), 'terrain', 'hazard', [63, 1])
    expect(tagsOf(next)[1]).toEqual({ tag: 'hazard', tiles: [1, 47, 63] })
    expect(tagsOf(next)).toHaveLength(tagsOf(platformer()).length)
  })

  it('returns the same project when every tile already carries the tag', () => {
    const project = platformer()
    expect(tagTiles(project, 'terrain', 'hazard', [47])).toBe(project)
    expect(tagTiles(project, 'terrain', 'new', [])).toBe(project)
  })

  it('refuses a tile beyond the tileset, a blank tag and an unknown tileset', () => {
    expect(() => tagTiles(platformer(), 'terrain', 'hazard', [64])).toThrow(/64/)
    expect(() => tagTiles(platformer(), 'terrain', 'hazard', [-1])).toThrow(RangeError)
    expect(() => tagTiles(platformer(), 'terrain', 'hazard', [1.5])).toThrow(RangeError)
    expect(() => tagTiles(platformer(), 'terrain', '  ', [1])).toThrow(/tag/)
    expect(() => tagTiles(platformer(), 'nope', 'x', [1])).toThrow(/no tileset/)
  })

  it('removes tiles from a tag and drops a tag left empty', () => {
    const fewer = untagTiles(platformer(), 'terrain', 'decor', [51, 52])
    expect(tagsOf(fewer).find((tag) => tag.tag === 'decor')?.tiles).toHaveLength(11)
    const gone = untagTiles(platformer(), 'terrain', 'hazard', [47])
    expect(tagsOf(gone).map((tag) => tag.tag)).toEqual(['solid', 'water', 'ladder', 'one-way', 'decor'])
  })

  it('returns the same project when the tag does not carry those tiles', () => {
    const project = platformer()
    expect(untagTiles(project, 'terrain', 'hazard', [3])).toBe(project)
  })

  it('throws for a tag the tileset does not have, like any other missing id', () => {
    expect(() => untagTiles(platformer(), 'terrain', 'missing', [3])).toThrow(/no tag "missing"/)
  })
})
