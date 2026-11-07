// The narrative content kinds: the converted scenes parse, and each bad reference is reported at its
// path, so the content compiler names the file and line.
import { describe, expect, it } from 'vitest'
import { canonSchema, dialogueFileSchema, linesFileSchema, storyletsFileSchema } from '#src/entries/sim.ts'
import { fixture, SCENES } from '#src/testing/converted-narrative.ts'

const paths = (
  schema: { safeParse(x: unknown): { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } },
  value: unknown,
) => {
  const r = schema.safeParse(value)
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.path)
}

describe('the converted scenes', () => {
  it('parse: lines, dialogue graphs, storylet decks and the canon', () => {
    for (const scene of SCENES) {
      expect(paths(linesFileSchema, fixture(`${scene}.lines.toml`)), `${scene} lines`).toEqual([])
      expect(paths(dialogueFileSchema, fixture(`${scene}.dialogue.toml`)), `${scene} dialogue`).toEqual([])
      expect(paths(storyletsFileSchema, fixture(`${scene}.storylets.toml`)), `${scene} storylets`).toEqual([])
    }
    expect(paths(canonSchema, fixture('canon.toml'))).toEqual([])
  })
})

describe('bad content, at its path', () => {
  it('a choice to an unknown node, and a start node the graph lacks', () => {
    const graph = {
      id: 'g',
      speaker: 'porter',
      start: 'nowhere',
      nodes: { a: { say: ['x'], choices: [{ line: 'y', next: 'gone' }] } },
    }
    expect(paths(dialogueFileSchema, { graphs: [graph] })).toEqual([
      ['graphs', 0, 'start'],
      ['graphs', 0, 'nodes', 'a', 'choices', 0, 'next'],
    ])
  })

  it('a line record with no kind', () => {
    expect(paths(linesFileSchema, { lines: [{ id: 'a.b', text: 'a.b' }] })).toEqual([['lines', 0, 'kind']])
  })

  it('a storylet with an unknown trigger', () => {
    expect(paths(storyletsFileSchema, { storylets: [{ id: 's', trigger: 'radio', lines: ['a'] }] })).toEqual([
      ['storylets', 0, 'trigger'],
    ])
  })

  it('a canon whose stance min is above its max', () => {
    const canon = { ...fixture('canon.toml'), stance: { min: 4, max: -4 } }
    expect(paths(canonSchema, canon)).toEqual([['stance']])
  })
})
