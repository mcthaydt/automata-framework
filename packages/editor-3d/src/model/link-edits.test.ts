// Nav edges as links (ED3D.7c step 3): a link joins two things of one definition, here Last Light's nav nodes, and may
// pass through a door box. Adding and removing one are edits, each one undo step, refused where the shipped editor
// refuses (editor/src/server/level-edits.ts `addNavEdge`, `removeNav`, 92e6704) in the `ids` and `nav` checks' words.
// The level is the toy with its nav written by hand: p (2, 2) and q (3.5, 2) in room a, s (4.625, 2) and r (5.57, 1.45)
// in room b, q–s through the doorway's door, and a spare node t (2, 3) with no edge.
import { describe, expect, it } from 'vitest'
import { idProblems } from '../checks/last-light/ids'
import { navProblems } from '../checks/last-light/nav-problems'
import type { AfSector } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { expand } from '../format/expand'
import { resolveMap } from '../geometry/sectors'
import { afSectorProfile } from '../profile/af-sector-profile'
import { blockoutCodec } from '../profile/last-light-codecs'
import { lastLightNavLinks } from '../profile/last-light-nav-links'
import { lastLightProfile } from '../profile/last-light-profile'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { toyBlockout } from '../testing/toy-blockout'
import type { Edit } from './edit'
import { createLevelEditor } from './level-editor'
import { addLink, removeLink } from './link-edits'
import { removeThing } from './thing-edits'

const level: Blockout = toyBlockout({
  nav: {
    derive: false,
    nodes: {
      p: { x: 2, z: 2 },
      q: { x: 3.5, z: 2 },
      s: { x: 4.625, z: 2 },
      r: { x: 5.57, z: 1.45 },
      t: { x: 2, z: 3 },
    },
    edges: [
      ['p', 'q'],
      ['q', 's', 'abDoor'],
      ['s', 'r'],
    ],
  },
})

const run = (edit: Edit<Blockout>, on: Blockout = level) => edit.run(lastLightProfile, on)
const edgesOf = (on: Blockout) => on.nav.edges ?? []
const problems = (on: Blockout): string[] => {
  const expanded = expand(on)
  const map = resolveMap(expanded.sectors, expanded.masses)
  return [...idProblems(on, expanded), ...navProblems(on, expanded, map)].map((problem) => problem.message)
}

describe('the Last Light links', () => {
  it('join nav nodes, pass through a box and are the file’s edges', () => {
    expect(lastLightProfile.links).toBe(lastLightNavLinks)
    expect(lastLightNavLinks.def).toBe('node')
    expect(lastLightNavLinks.list(level)).toEqual([
      { a: 'p', b: 'q' },
      { a: 'q', b: 's', via: 'abDoor' },
      { a: 's', b: 'r' },
    ])
    expect(lastLightNavLinks.list(toyBlockout())).toEqual([])
  })

  it('are none for an af-sector level', () => {
    expect(afSectorProfile.links).toBeUndefined()
  })
})

describe('addLink', () => {
  it('appends an edge between two nodes, and the checks have nothing new to say', () => {
    const edit = addLink<Blockout>({ a: 'p', b: 't' })
    expect(edit.id).toBe('link.add')
    expect(edit.label).toBe('Link p–t')
    const next = levelOf(run(edit))
    expect(edgesOf(next)).toEqual([...edgesOf(level), ['p', 't']])
    expect(next.nav.nodes).toBe(level.nav.nodes)
    expect(problems(next)).toEqual(problems(level))
  })

  it('writes the door an edge passes through as its third member', () => {
    const without: Blockout = {
      ...level,
      nav: {
        ...level.nav,
        edges: [
          ['p', 'q'],
          ['s', 'r'],
        ],
      },
    }
    const next = levelOf(run(addLink({ a: 'q', b: 's', via: 'abDoor' }), without))
    expect(edgesOf(next)).toEqual([
      ['p', 'q'],
      ['s', 'r'],
      ['q', 's', 'abDoor'],
    ])
    // Every door open, as the check asks: an edge through the doorway is clear with or without its door named.
    expect(edgesOf(levelOf(run(addLink({ a: 'q', b: 's' }), without)))).toEqual([
      ['p', 'q'],
      ['s', 'r'],
      ['q', 's'],
    ])
  })

  it('starts the edges of a level that has none', () => {
    const bare: Blockout = { ...level, nav: { derive: false, nodes: level.nav.nodes } }
    expect(edgesOf(levelOf(run(addLink({ a: 'p', b: 'q' }), bare)))).toEqual([['p', 'q']])
  })

  it('is refused where the shipped editor refuses, in the checks’ words', () => {
    expect(reasonOf(run(addLink({ a: 'p', b: 'q' }), toyBlockout()))).toBe(
      'this blockout derives its nav from the rooms and openings (nav.derive is not false): the generator places the nodes and edges, so there is nothing to place by hand',
    )
    expect(reasonOf(run(addLink({ a: 'p', b: 'gone' })))).toBe('no nav node gone')
    expect(reasonOf(run(addLink({ a: 'p', b: 'p' })))).toBe('an edge joins two different nodes')
    expect(reasonOf(run(addLink({ a: 'q', b: 'p' })))).toBe('there is already an edge q–p')
    // The same two nodes through a different door are still the same edge.
    expect(reasonOf(run(addLink({ a: 's', b: 'q' })))).toBe('there is already an edge s–q')
    expect(reasonOf(run(addLink({ a: 'q', b: 's', via: 'abDoor' })))).toBe('there is already an edge q–s')
    expect(reasonOf(run(addLink({ a: 't', b: 'q', via: 'nothing' })))).toBe(
      'nav edge t–q: nothing is not a door box',
    )
    expect(reasonOf(run(addLink({ a: 't', b: 'q', via: 'far' })))).toBe('nav edge t–q: far is not a door box')
    expect(reasonOf(run(addLink({ a: 'p', b: 'r' })))).toBe(
      'edge p–r is not clear by 0.3 m with the doors open',
    )
  })

  it('is refused for a level with no links', () => {
    const depot = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!depot.ok) throw new Error('the depot does not parse')
    expect(reasonOf(addLink<AfSector>({ a: 'spawn', b: 'crate1' }).run(afSectorProfile, depot.value))).toBe(
      'this level has no links',
    )
  })

  it('is one undo step through the editor', () => {
    const editor = createLevelEditor({ profile: lastLightProfile, level })
    expect(editor.run(addLink({ a: 'p', b: 't' })).ok).toBe(true)
    expect(editor.history.undoLabel).toBe('Link p–t')
    editor.history.undo()
    expect(editor.level).toBe(level)
  })
})

describe('the clearance of a level of several layers', () => {
  it('is refused when any layer says the edge is not clear, not only the first', () => {
    const clearWorld = lastLightProfile.geometry({
      ...level,
      nav: { ...level.nav, nodes: { ...level.nav.nodes, r: { x: 2.5, z: 2 } } },
    }).layers
    const real = lastLightProfile.geometry(level).layers
    expect(() =>
      lastLightNavLinks.add(level, { a: 'p', b: 'r' }, { layers: [...clearWorld, ...real] }),
    ).toThrow('edge p–r is not clear by 0.3 m with the doors open')
    expect(
      lastLightNavLinks.add(level, { a: 'p', b: 't' }, { layers: [...clearWorld, ...real] }).nav.edges,
    ).toHaveLength(4)
  })
})

describe('removeLink', () => {
  it('takes out the edge between two nodes, named either way round', () => {
    const edit = removeLink<Blockout>({ a: 'q', b: 'p' })
    expect(edit.id).toBe('link.remove')
    expect(edit.label).toBe('Unlink q–p')
    expect(edgesOf(levelOf(run(edit)))).toEqual([
      ['q', 's', 'abDoor'],
      ['s', 'r'],
    ])
    expect(edgesOf(levelOf(run(removeLink({ a: 's', b: 'q' }))))).toEqual([
      ['p', 'q'],
      ['s', 'r'],
    ])
  })

  it('answers that there is no such edge, and refuses a derived nav', () => {
    expect(reasonOf(run(removeLink({ a: 'p', b: 't' })))).toBe('no nav edge p–t')
    expect(reasonOf(run(removeLink({ a: 'p', b: 'q' }), toyBlockout()))).toMatch(
      /^this blockout derives its nav/,
    )
  })

  it('frees a node for removal once its last edge is gone', () => {
    const linked = levelOf(run(addLink({ a: 'p', b: 't' })))
    expect(reasonOf(run(removeThing({ def: 'node', id: 't' }), linked))).toBe(
      'node t is still referenced: nav edge p–t: names t',
    )
    const unlinked = levelOf(run(removeLink({ a: 'p', b: 't' }), linked))
    expect(levelOf(run(removeThing({ def: 'node', id: 't' }), unlinked)).nav.nodes).not.toHaveProperty('t')
  })

  it('is written into a shipped file as the removal of that one element', () => {
    const text = loadFixture('blockout-clinic-dawn')
    const parsed = blockoutCodec.parse(text)
    if (!parsed.ok) throw new Error('clinic-dawn does not parse')
    const [first] = parsed.value.nav.edges ?? []
    if (first === undefined) throw new Error('clinic-dawn has no edges')
    const next = levelOf(
      removeLink<Blockout>({ a: first[0], b: first[1] }).run(lastLightProfile, parsed.value),
    )
    const patched = blockoutCodec.patch(text, parsed.value, next)
    expect(patched.ok).toBe(true)
    if (!patched.ok) return
    const reread = blockoutCodec.parse(patched.text)
    expect(reread.ok && reread.value).toEqual(next)
    expect(text.length - patched.text.length).toBeLessThan(80)
  })
})
