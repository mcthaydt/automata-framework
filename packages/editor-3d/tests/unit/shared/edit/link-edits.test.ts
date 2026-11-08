// The link edits (ED3D.7c step 3): a link joins two things of one definition. Adding and removing one are edits, each one
// undo step. The depot's format has no links, so these run on the depot with links held in the test: a profile that has
// them decides what it refuses, and the edit passes its sentence on.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { addLink, removeLink } from '#src/shared/edit/link-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { GeometryError, type LevelProfile } from '#src/shared/level-session/level-profile.ts'
import { ThingAccessError } from '#src/shared/level-session/thing-access.ts'
import type { ThingLink, ThingLinks } from '#src/shared/level-session/thing-links.ts'
import { levelOf, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

/** Links kept beside the level, keyed by the level object, so each edit's result carries its own list. */
function profileWithLinks(start: readonly ThingLink[] = []): {
  profile: LevelProfile<AfSector>
  links: Map<AfSector, readonly ThingLink[]>
} {
  const links = new Map<AfSector, readonly ThingLink[]>([[depot, start]])
  const thingLinks: ThingLinks<AfSector> = {
    def: 'crate',
    list: (doc) => links.get(doc) ?? [],
    add(doc, link) {
      if (link.a === link.b) throw new ThingAccessError('a thing cannot be linked to itself')
      if (link.a === 'far') throw new GeometryError('far is out of reach')
      const next = { ...doc }
      links.set(next, [...(links.get(doc) ?? []), link])
      return next
    },
    remove(doc, a, b) {
      const kept = (links.get(doc) ?? []).filter((link) => !(link.a === a && link.b === b))
      if (kept.length === (links.get(doc) ?? []).length)
        throw new ThingAccessError(`${a} and ${b} are not linked`)
      const next = { ...doc }
      links.set(next, kept)
      return next
    },
  }
  return { profile: { ...afSectorProfile, links: thingLinks }, links }
}

describe('addLink', () => {
  it('adds the link after the others and says which two it joins', () => {
    const { profile, links } = profileWithLinks([{ a: 'x', b: 'y' }])
    const edit = addLink<AfSector>({ a: 'p', b: 'q' })
    expect(edit.id).toBe('link.add')
    expect(edit.label).toBe('Link p–q')
    const next = levelOf(edit.run(profile, depot))
    expect(links.get(next)).toEqual([
      { a: 'x', b: 'y' },
      { a: 'p', b: 'q' },
    ])
  })

  it('passes on the sentence of a link the level may not have, and changes nothing', () => {
    const { profile } = profileWithLinks()
    expect(reasonOf(addLink<AfSector>({ a: 'p', b: 'p' }).run(profile, depot))).toBe(
      'a thing cannot be linked to itself',
    )
  })

  it('passes on the sentence of a level whose geometry refuses', () => {
    const { profile } = profileWithLinks()
    expect(reasonOf(addLink<AfSector>({ a: 'far', b: 'q' }).run(profile, depot))).toBe('far is out of reach')
  })

  it('is refused on a level whose profile has no links', () => {
    expect(reasonOf(addLink<AfSector>({ a: 'spawn', b: 'crate1' }).run(afSectorProfile, depot))).toBe(
      'this level has no links',
    )
  })

  it('is one undo step through the editor', () => {
    const { profile } = profileWithLinks()
    const editor = createLevelEditor({ profile, level: depot })
    expect(editor.run(addLink({ a: 'p', b: 'q' })).ok).toBe(true)
    expect(editor.history.undoLabel).toBe('Link p–q')
    editor.history.undo()
    expect(editor.level).toBe(depot)
  })
})

describe('removeLink', () => {
  it('takes the link between two things away, whichever way round it is asked', () => {
    const { profile, links } = profileWithLinks([
      { a: 'p', b: 'q' },
      { a: 'q', b: 's' },
    ])
    const edit = removeLink<AfSector>({ a: 'p', b: 'q' })
    expect(edit.id).toBe('link.remove')
    expect(edit.label).toBe('Unlink p–q')
    expect(links.get(levelOf(edit.run(profile, depot)))).toEqual([{ a: 'q', b: 's' }])
  })

  it('says so when the two are not linked, and is refused on a level whose profile has no links', () => {
    const { profile } = profileWithLinks()
    expect(reasonOf(removeLink<AfSector>({ a: 'p', b: 'q' }).run(profile, depot))).toBe(
      'p and q are not linked',
    )
    expect(reasonOf(removeLink<AfSector>({ a: 'p', b: 'q' }).run(afSectorProfile, depot))).toBe(
      'this level has no links',
    )
  })
})
