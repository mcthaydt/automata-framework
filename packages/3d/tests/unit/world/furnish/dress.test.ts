// The dresser: a room that asks for a kit is filled from it, the same every run, and the result draws with core alone.

import { describe, expect, it } from 'vitest'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { dressLevel } from '#src/features/world/furnish/dress.ts'
import '#src/features/world/props/kit/register-kit-props.ts'
import { room } from '../../../fixtures/world/level.ts'

const KITS = Object.keys(coreLibrary.kits ?? {})

describe('dressing a room', () => {
  it('is deterministic, and every piece has an id of the room, the layer and a number', () => {
    for (const kit of KITS) {
      const first = dressLevel(room(kit, 3), coreLibrary)
      const again = dressLevel(room(kit, 3), coreLibrary)
      expect(first, kit).toEqual(again)
      expect(first.problems, kit).toEqual([])
      const props = first.level.props ?? []
      expect(props.length, kit).toBeGreaterThan(0)
      for (const prop of props) expect(prop.id, kit).toMatch(/^room:[a-z]+:\d+$/)
      expect(new Set(props.map((p) => p.id)).size, kit).toBe(props.length)
    }
  })

  it('differs by seed', () => {
    const a = dressLevel(room('office', 1), coreLibrary).level.props
    const b = dressLevel(room('office', 2), coreLibrary).level.props
    expect(a).not.toEqual(b)
  })

  it('leaves a room bare, and says so, when the library has no such kit', () => {
    const { level, problems } = dressLevel(room('throne room'), coreLibrary)
    expect(level.props ?? []).toEqual([])
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'unknown-kit', name: 'throne room', where: 'room' }),
    )
  })

  it('keeps what was placed by hand, and takes out and moves what the dress edits name', () => {
    const base = dressLevel(room('office', 3), coreLibrary).level.props ?? []
    const [gone, moved] = [base[0], base[1]]
    if (gone === undefined || moved === undefined) throw new Error('an office holds pieces')
    const level = room('office', 3)
    const sector = level.sectors[0]
    if (sector?.dress === undefined) throw new Error('fixture has a dress')
    const edited = {
      ...level,
      sectors: [
        { ...sector, dress: { ...sector.dress, remove: [gone.id], pin: { [moved.id]: { at: [2.5, 2.5] } } } },
      ],
    }
    const props = dressLevel(edited, coreLibrary).level.props ?? []
    expect(props.map((p) => p.id)).not.toContain(gone.id)
    expect(props.find((p) => p.id === moved.id)?.at).toEqual([2.5, 2.5])
  })

  it('draws furnished once dressed, and bare, without a note, before', () => {
    const level = room('office', 3)
    expect(buildWorld(level, coreLibrary).pieces.filter((p) => p.part === 'prop')).toHaveLength(0)
    const dressed = dressLevel(level, coreLibrary)
    const { pieces, problems } = buildWorld(dressed.level, coreLibrary)
    expect(problems).toEqual([])
    expect(pieces.filter((p) => p.part === 'prop').length).toBeGreaterThan(0)
    expect(dressed.level.dress).toBeUndefined()
    expect(dressed.level.sectors[0]?.dress).toBeUndefined()
  })
})
