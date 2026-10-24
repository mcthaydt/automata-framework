// The geometry cache (ED3D.6b): the layers and the selection ids of the editor's live level, built once for each level
// the editor holds and not once for each pointer move. A level that cannot be resolved has no layers.
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { moveSector } from '../model/corner-edits'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import { toyAfSector } from '../testing/toy-af-sector'
import { createGeometryCache } from './geometry-cache'

const level: AfSector = toyAfSector()

describe('createGeometryCache', () => {
  it('builds the layers and the selection ids of the live level', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    const geometry = createGeometryCache(editor)()
    expect(geometry.level).toBe(editor.level)
    expect(geometry.layers.flatMap((layer) => layer.map.sectors.map((sector) => sector.id))).toEqual([
      'hall',
      'dock',
    ])
    expect(geometry.select.sector('hall')).toBe('sector:hall')
  })

  it('is the same object for the same level, and a new one for each level after an edit', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    const geometry = createGeometryCache(editor)
    const first = geometry()
    expect(geometry()).toBe(first)
    editor.run(moveSector({ id: 'dock', dx: 1, dz: 0 }))
    const second = geometry()
    expect(second).not.toBe(first)
    expect(second.level).toBe(editor.level)
    expect(geometry()).toBe(second)
  })

  it('has no layers for a level the engine cannot build, and goes on working', () => {
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      geometry() {
        throw new GeometryError('the engine cannot build it')
      },
    }
    const editor = createLevelEditor({ profile, level })
    const geometry = createGeometryCache(editor)()
    expect(geometry.layers).toEqual([])
    expect(geometry.select.sector('hall')).toBe('sector:hall')
  })

  it('does not hide an error that is not the engine refusing the level', () => {
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      geometry() {
        throw new Error('a bug')
      },
    }
    const editor = createLevelEditor({ profile, level })
    expect(() => createGeometryCache(editor)()).toThrow('a bug')
  })
})
