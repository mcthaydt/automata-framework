import { navGraphSchema } from '@automata/nav/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { convertNav } from '../../../tools/convert/nav.ts'

const BLOCKOUT = {
  nav: {
    derive: false,
    nodes: { end: { x: 0, z: -6.1 }, cmid: { x: 0.3, z: -4 }, closet: { x: 3, z: -4 } },
    edges: [
      ['end', 'cmid'],
      ['cmid', 'closet', 'closetDoor'],
    ],
    patrol: ['end', 'cmid', 'closet'],
  },
}

describe('convertNav', () => {
  it('writes a graph the nav kind accepts, with the door on its edge', () => {
    const { files } = convertNav(BLOCKOUT)
    const graph = navGraphSchema.parse(parse(files['content/nav/prologue.toml'] as string))
    expect(Object.keys(graph.nodes)).toEqual(['end', 'cmid', 'closet'])
    expect(graph.edges).toEqual([
      ['end', 'cmid'],
      ['cmid', 'closet', 'closetDoor'],
    ])
  })

  it('says the patrol is the systems file’s now, and writes nothing else', () => {
    const { files, report } = convertNav(BLOCKOUT)
    expect(Object.keys(files)).toEqual(['content/nav/prologue.toml'])
    expect(report).toContainEqual(
      expect.objectContaining({ kind: 'nav', what: expect.stringContaining('patrol') }),
    )
  })

  it('refuses a blockout with no nav in words', () => {
    expect(() => convertNav({})).toThrow(/no nav/)
  })
})
