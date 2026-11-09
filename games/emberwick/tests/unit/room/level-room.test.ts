import { content, simContent } from 'virtual:automata/content'
import { levelContentSchema } from '@automataframework/automata-content/level-2d'
import { describe, expect, it } from 'vitest'
import { roomSourceOfLevel } from '#src/features/room/level-room.ts'
import { ROOM as HAND_WRITTEN } from '../../../fixtures/hand-written-room.ts'
import { HAND_WRITTEN_TUNING } from '../../../fixtures/hand-written-tuning.ts'

// The room the 2D editor authored, as compiled content, is the room that was written by hand (GAME-2D.ED): the same
// tiles, the same start and ember, and the same tunables.

const compiled = simContent.levels['room-1']
const level = compiled === undefined ? undefined : levelContentSchema.parse(compiled)

describe('the compiled room', () => {
  it('has the rows, the start and the ember of the hand-written room', () => {
    if (level === undefined) throw new Error('no level room-1 in the compiled content')
    expect(roomSourceOfLevel(level)).toEqual(HAND_WRITTEN)
  })

  it('refuses a level with no collision layer, naming it', () => {
    if (level === undefined) throw new Error('no level room-1 in the compiled content')
    expect(() => roomSourceOfLevel({ ...level, layers: [] })).toThrow(/collision/)
  })

  it('keeps the pivots it decodes the start and the ember with', () => {
    const entities = (
      content as unknown as { project: { entities: { id: string; pivot: { x: number; y: number } }[] } }
    ).project.entities
    expect(entities.find((entity) => entity.id === 'player-start')?.pivot).toEqual({ x: 0.5, y: 1 })
    expect(entities.find((entity) => entity.id === 'goal')?.pivot).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('the compiled tuning', () => {
  it('holds the hand-written tunables', () => {
    expect(simContent.tuning).toEqual(HAND_WRITTEN_TUNING)
  })
})
