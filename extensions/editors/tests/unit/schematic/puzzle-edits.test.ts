import type { PuzzleDef } from '@automata/puzzle/sim'
import { describe, expect, it } from 'vitest'
import {
  addFactEdits,
  addItemEdits,
  puzzleNames,
  removeFactEdits,
  removeItemEdits,
  usedBy,
} from '#src/features/schematic/puzzle/puzzle-edits.ts'

const def: PuzzleDef = {
  scene: 'hall',
  facts: { power: false, fuel: 2 },
  items: ['crank', 'fuse'],
  hotspots: { shutter: { x: 0, z: 0 }, desk: { x: 3, z: 1 } },
  entry: [{ name: 'start', items: ['crank'], facts: { fuel: 3 } }],
  actions: [
    {
      id: 'crank-it',
      at: 'shutter',
      use: 'crank',
      when: [{ fact: 'fuel', atLeast: 1 }, { not: { has: 'fuse' } }],
      then: [{ set: 'power', to: true }, { take: 'fuse' }],
      say: 'It whirs.',
    },
    { id: 'combine-them', at: 'combine', use: ['crank', 'fuse'], then: [{ give: 'fuse' }], say: 'Click.' },
  ],
  systemic: [{ id: 'sys', note: 'n', enables: [{ fact: 'power', is: true }], via: ['crank-it'] }],
  lethal: [],
  goal: [{ fact: 'power', is: true }],
  fallback: {},
}

describe('what a puzzle names', () => {
  it('lists the facts, items, hotspots and the game’s calls for the menus', () => {
    expect(puzzleNames(def)).toMatchObject({
      facts: ['power', 'fuel'],
      items: ['crank', 'fuse'],
      places: ['shutter', 'desk'],
      hooks: [],
    })
  })

  it('finds everything that uses an item', () => {
    const uses = usedBy(def, 'item', 'fuse')
    expect(uses).toContain('the action crank-it')
    expect(uses).toContain('the action combine-them')
    expect(usedBy(def, 'item', 'crank')).toContain('the way in start')
  })

  it('finds everything that uses a fact', () => {
    const uses = usedBy(def, 'fact', 'power')
    expect(uses).toEqual(['the action crank-it', 'the goal', 'the other way (sys)'])
    expect(usedBy(def, 'fact', 'nothing')).toEqual([])
  })
})

describe('items and facts added and taken away', () => {
  it('adds an item at the end of the list, once', () => {
    expect(addItemEdits(def, 'torch')).toEqual([{ keyPath: ['items'], insert: 'torch' }])
    expect(addItemEdits(def, 'crank')).toEqual({ refused: 'There is already an item called “crank”.' })
    expect(addItemEdits(def, '  ')).toEqual({ refused: 'An item needs a name.' })
  })

  it('takes an item out only when nothing uses it', () => {
    const refused = removeItemEdits(def, 'crank')
    expect(refused).toHaveProperty('refused')
    expect((refused as { refused: string }).refused).toMatch(/^“crank” is still used by /)
    expect(removeItemEdits({ ...def, entry: [], actions: [], systemic: [] }, 'fuse')).toEqual([
      { keyPath: ['items', 1], remove: true },
    ])
  })

  it('adds a fact with the value yes, once', () => {
    expect(addFactEdits(def, 'alarm')).toEqual([{ keyPath: ['facts', 'alarm'], insert: false }])
    expect(addFactEdits(def, 'power')).toEqual({ refused: 'There is already a fact called “power”.' })
  })

  it('takes a fact out only when nothing uses it', () => {
    expect(removeFactEdits(def, 'power')).toHaveProperty('refused')
    expect(removeFactEdits({ ...def, actions: [], goal: [], systemic: [], entry: [] }, 'fuel')).toEqual([
      { keyPath: ['facts', 'fuel'], remove: true },
    ])
  })
})
