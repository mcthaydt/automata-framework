import { describe, expect, it } from 'vitest'
import { entity, withEntities, withNewLevel } from '../../../../testing/level-2d/project-edit'
import type { FieldDef } from '../../../kit/fields/field-types.ts'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { counterIds } from '../ids'
import type { Project } from '../project-types'
import { isRefValue, refIndex, resolveRef } from './ref-resolve'

/** A spawn in `level-2` and a coin in `level-1`. */
function project(): Project {
  const second = withNewLevel(platformerTemplate.create(counterIds()), 'level-2', { x: 600, y: 0 })
  const spawned = withEntities(second, 'level-2', [entity('spawn-2', 'player-start', 32, 256)])
  return withEntities(spawned, 'level-1', [entity('coin-1', 'coin', 64, 64)])
}

const field = (to?: readonly string[]): FieldDef => ({
  id: 'target',
  type: 'ref',
  ...(to === undefined ? {} : { to: [...to] }),
})

describe('resolveRef (2D editor spec §9, Refs)', () => {
  const index = refIndex(project())

  it('finds an instance by id, and the level it is in', () => {
    expect(resolveRef(index, field(['player-start']), { target: 'spawn-2', container: 'level-2' })).toEqual({
      ok: true,
      level: 'level-2',
      item: { id: 'spawn-2', def: 'player-start', x: 32, y: 256 },
    })
    expect(resolveRef(index, field(['player-start']), { target: 'spawn-2' })).toMatchObject({ ok: true })
  })

  it('finds a level when the field may point at one, or at anything', () => {
    expect(resolveRef(index, field(['$level']), { target: 'level-2' })).toEqual({
      ok: true,
      level: 'level-2',
    })
    expect(resolveRef(index, field(), { target: 'level-2' })).toEqual({ ok: true, level: 'level-2' })
    expect(resolveRef(index, field(['player-start']), { target: 'level-2' })).toMatchObject({
      ok: false,
      code: 'brokenRef',
    })
  })

  it('is brokenRef when the target is gone or not in its container', () => {
    expect(resolveRef(index, field(), { target: 'gone' })).toEqual({
      ok: false,
      code: 'brokenRef',
      message: '"gone" does not exist.',
    })
    expect(resolveRef(index, field(), { target: 'spawn-2', container: 'level-1' })).toEqual({
      ok: false,
      code: 'brokenRef',
      message: '"spawn-2" is not in level "level-1".',
    })
    expect(resolveRef(index, field(), { target: 'spawn-2', container: 'nowhere' })).toMatchObject({
      message: '"spawn-2" is not in level "nowhere", which does not exist.',
    })
  })

  it('is refWrongKind when the target is a definition the field does not allow', () => {
    expect(resolveRef(index, field(['player-start', '$level']), { target: 'coin-1' })).toEqual({
      ok: false,
      code: 'refWrongKind',
      message: '"coin-1" is a coin, but "target" points at player-start, a level.',
    })
  })

  it('tells a ref value from anything else', () => {
    expect(isRefValue({ target: 'a' })).toBe(true)
    expect(isRefValue({ target: 'a', container: 'b' })).toBe(true)
    expect(isRefValue([{ target: 'a' }])).toBe(false)
    expect(isRefValue({ x: 1, y: 2 })).toBe(false)
    expect(isRefValue(undefined)).toBe(false)
  })
})
