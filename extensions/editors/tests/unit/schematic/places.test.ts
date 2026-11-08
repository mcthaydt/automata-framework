import { openDocument } from '@automata/editor/kit/documents'
import { navGraphSchema } from '@automata/nav/sim'
import { systemsDefShape } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import {
  addPlaceEdits,
  connectEdits,
  disconnectEdits,
  doorWords,
  namedBy,
  placeSentence,
  removePlaceEdits,
  renamePlaceEdits,
} from '#src/features/schematic/places-edits.ts'

const NAV_TEXT = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string
const HALL_TEXT = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const nav = () => navGraphSchema.parse(openDocument('n.toml', NAV_TEXT).value())
const hall = () => systemsDefShape.parse(openDocument('h.toml', HALL_TEXT).value())
const apply = (text: string, edits: unknown) => {
  if (!Array.isArray(edits)) throw new Error(JSON.stringify(edits))
  const result = openDocument('x.toml', text).edit(edits)
  if (!result.ok) throw new Error(result.message)
  return result.document
}

describe('places', () => {
  it('reads each place as a sentence, and a door in words', () => {
    expect(placeSentence(nav(), 'desk')).toBe('desk: 5 across, 4 down. Walks to door, window')
    expect(doorWords(['a', 'b', 'ward-door'])).toBe('through the ward door')
    expect(doorWords(['a', 'b'])).toBeUndefined()
  })

  it('adds a place, and refuses a name that is taken or empty', () => {
    const doc = apply(NAV_TEXT, addPlaceEdits(nav(), 'bench', 3, 6))
    expect(navGraphSchema.parse(doc.value()).nodes.bench).toEqual({ x: 3, z: 6 })
    expect(addPlaceEdits(nav(), 'desk', 0, 0)).toHaveProperty('refused')
    expect(addPlaceEdits(nav(), ' ', 0, 0)).toHaveProperty('refused')
  })

  it('joins two places once, whichever way round, and takes the join away', () => {
    const joined = apply(NAV_TEXT, connectEdits(nav(), 'door', 'window'))
    const graph = navGraphSchema.parse(joined.value())
    expect(graph.edges).toHaveLength(3)
    expect(connectEdits(graph, 'window', 'door')).toHaveProperty('refused')
    expect(connectEdits(graph, 'door', 'door')).toHaveProperty('refused')
    const apart = apply(joined.text, disconnectEdits(graph, 'window', 'door'))
    expect(navGraphSchema.parse(apart.value()).edges).toHaveLength(2)
  })

  it('renames a place everywhere it is named', () => {
    const edits = renamePlaceEdits(nav(), hall(), 'desk', 'counter')
    if ('refused' in edits) throw new Error(edits.refused)
    const n = navGraphSchema.parse(apply(NAV_TEXT, edits.nav).value())
    expect(Object.keys(n.nodes)).toContain('counter')
    expect(Object.keys(n.nodes)).not.toContain('desk')
    expect(n.edges).toEqual([
      ['door', 'counter'],
      ['counter', 'window'],
    ])
    const h = systemsDefShape.parse(apply(HALL_TEXT, edits.systems).value())
    expect(h.agents[0]?.routine?.map((s) => s.node)).toEqual(['door', 'counter', 'window'])
    expect(JSON.stringify(h)).not.toContain('"desk"')
  })

  it('refuses to remove a place something names, with what names it', () => {
    const refused = removePlaceEdits(nav(), hall(), 'desk')
    expect(refused).toHaveProperty('refused')
    expect((refused as { refused: string }).refused).toContain('patrols to it')
    expect(namedBy(hall(), 'desk')).toHaveLength(1)
  })

  it('removes a place nothing names, and its joins', () => {
    const withExtra = apply(NAV_TEXT, addPlaceEdits(nav(), 'bench', 3, 6))
    const joined = apply(
      withExtra.text,
      connectEdits(navGraphSchema.parse(withExtra.value()), 'bench', 'door'),
    )
    const graph = navGraphSchema.parse(joined.value())
    const gone = apply(joined.text, removePlaceEdits(graph, hall(), 'bench'))
    const after = navGraphSchema.parse(gone.value())
    expect(Object.keys(after.nodes)).toEqual(['door', 'desk', 'window'])
    expect(after.edges).toHaveLength(2)
  })
})
