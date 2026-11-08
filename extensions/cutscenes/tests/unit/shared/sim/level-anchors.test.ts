import type { ContentLevel } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { levelAnchors } from '#src/shared/sim/level-anchors.ts'

// A script can start a character where the editor put it: `at = "actor:keeper"`. The points are metres, the level's
// are pixels, so the anchors divide by the metre once, here.

const LEVEL = {
  id: 'yard',
  layers: [
    {
      kind: 'entities',
      def: 'people',
      items: [
        { id: 'a', def: 'keeper-def', x: 200, y: 256, fields: { name: 'keeper' } },
        { id: 'b', def: 'guard-def', x: 400, y: 256, fields: {} },
      ],
    },
    { kind: 'tiles', def: 'decor', cells: {} },
  ],
} as unknown as ContentLevel

describe('levelAnchors', () => {
  const anchor = levelAnchors(LEVEL, 16)

  it('puts actor:<name> at the placed character, in metres', () => {
    expect(anchor('actor:keeper')).toEqual({ x: 12.5, z: 16 })
  })

  it('knows nothing of a character with no name, another kind of anchor, or a name the level lacks', () => {
    expect(anchor('actor:guard')).toBeUndefined()
    expect(anchor('player')).toBeUndefined()
    expect(anchor('actor:nobody')).toBeUndefined()
  })
})
