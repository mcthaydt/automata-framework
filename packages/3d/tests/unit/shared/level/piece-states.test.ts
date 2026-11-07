// The states a scene's pieces are in while it plays: a door's opening, a lamp's level, a prop's place. Plain data a
// track can drive; nothing here knows a renderer.
import { describe, expect, it } from 'vitest'
import {
  doorOpen,
  lampState,
  noPieceStates,
  type PieceStates,
  propState,
  sameProp,
} from '#src/shared/level/piece-states.ts'

describe('piece states', () => {
  it('start empty: every door shut, every lamp as authored, every prop where it was put', () => {
    const states = noPieceStates()
    expect(states).toEqual({ doors: {}, lamps: {}, props: {} })
    expect(doorOpen(states, 'hall')).toBe(0)
    expect(lampState(states, 'l1')).toEqual({ level: 1 })
    expect(propState(states, 'crate')).toEqual({})
  })

  it('give a door only the opening it was set to, held between shut and open', () => {
    const states: PieceStates = { ...noPieceStates(), doors: { hall: 0.5, vault: 3, cell: -1 } }
    expect(doorOpen(states, 'hall')).toBe(0.5)
    expect(doorOpen(states, 'vault')).toBe(1)
    expect(doorOpen(states, 'cell')).toBe(0)
  })

  it('compare a prop with itself by value, not by identity', () => {
    expect(sameProp({ at: [1, 0, 2], turn: 30 }, { at: [1, 0, 2], turn: 30 })).toBe(true)
    expect(sameProp({ at: [1, 0, 2] }, { at: [1, 0, 3] })).toBe(false)
    expect(sameProp({ hidden: true }, {})).toBe(false)
    expect(sameProp({}, {})).toBe(true)
  })
})
