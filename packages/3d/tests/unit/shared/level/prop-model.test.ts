// A prop names the model that replaces its generated blockout on screen: the level keeps the name and the fit, and lists
// the files a game must preload. A level that names none reads as it always did.
import { describe, expect, it } from 'vitest'
import { type AfSector2, modelsOf, readLevel } from '#src/entries/level.ts'

const room = {
  id: 'a',
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
}
const file = (props: unknown[]): unknown => ({ format: 'af-sector/2', name: 't', sectors: [room], props })

describe('a prop that names a model', () => {
  it('keeps the model and its fit through readLevel', () => {
    const read = readLevel(
      file([
        {
          id: 'bed',
          at: [1, 1],
          kind: 'box',
          model: 'models/bed.bin',
          fit: { scale: 0.9, offset: [0, 0.1, 0], turn: 90 },
        },
      ]),
    )
    expect(read.problems).toEqual([])
    expect(read.level.props?.[0]).toMatchObject({
      model: 'models/bed.bin',
      fit: { scale: 0.9, offset: [0, 0.1, 0], turn: 90 },
    })
  })

  it('reads a level that names none exactly as before', () => {
    const read = readLevel(file([{ id: 'crate', at: [1, 1], kind: 'box' }]))
    expect(read.problems).toEqual([])
    expect(read.level.props?.[0]).not.toHaveProperty('model')
    expect(read.level.props?.[0]).not.toHaveProperty('fit')
  })

  it('refuses a model that is not a name, and a fit that is not numbers', () => {
    expect(readLevel(file([{ id: 'a', at: [1, 1], model: 7 }])).problems).not.toEqual([])
    expect(
      readLevel(file([{ id: 'a', at: [1, 1], model: 'm.bin', fit: { scale: 'big' } }])).problems,
    ).not.toEqual([])
  })
})

describe('modelsOf', () => {
  const level = (props: AfSector2['props']): AfSector2 => readLevel(file([...(props ?? [])])).level

  it('lists each file once, sorted, for the renderer to load', () => {
    expect(
      modelsOf(
        level([
          { id: 'b', at: [1, 1], model: 'models/b.bin' },
          { id: 'a', at: [2, 2], model: 'models/a.bin' },
          { id: 'c', at: [3, 3], model: 'models/b.bin' },
          { id: 'd', at: [3, 1], kind: 'box' },
        ]),
      ),
    ).toEqual(['models/a.bin', 'models/b.bin'])
  })

  it('lists none for a level with no model, or no props', () => {
    expect(modelsOf(level([{ id: 'd', at: [3, 1], kind: 'box' }]))).toEqual([])
    expect(modelsOf(level(undefined))).toEqual([])
  })
})
