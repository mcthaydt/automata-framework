// Without the kit loaded, core says plainly what is missing and draws the rest: this file imports no generator.
import { buildWorld, resolveProp } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { levelWith } from '../../fixtures/level.ts'

describe('a game without the world kit', () => {
  it('is told a chair has no generator', () => {
    expect(resolveProp({ kind: 'chair' }, { swatches: {} })).toEqual({
      code: 'unknown-generator',
      name: 'chair',
    })
    const { problems } = buildWorld(levelWith([{ id: 'c', kind: 'chair', at: [3, 3] }]), { swatches: {} })
    expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-generator', name: 'chair' }))
  })
})
