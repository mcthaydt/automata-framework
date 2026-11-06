import { describe, expect, it, vi } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import {
  cardTitle,
  duplicateMessage,
  entryBadge,
  homeCard,
  importMessage,
  importNotices,
  kindTone,
  removeMessage,
  searchWords,
  templateCards,
} from '#src/features/home/home-model.ts'
import { filterEntries } from '#src/shared/kit/home/project-browse.ts'
import type { LevelThumbnails } from '#src/shared/level-2d/canvas/level-thumbnails.ts'
import type { CopyOutcome, ImportOutcome, OpenOutcome } from '#src/shared/level-2d/documents/editor-app.ts'
import type { ProjectEntry } from '#src/shared/level-2d/documents/project-list.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import { plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// What Home decides before anything is drawn (plan ED2D.4c2a step 4): pure functions of the list, the registry and the
// workspace. The components only show what these return.

const ref = { id: 'level-project', label: 'Level project' }
const note = { id: 'planted', label: 'Planted note' }
const listed = { size: 100, mtime: 0 }

function ok(path: string, over: Partial<Extract<ProjectEntry, { status: 'ok' }>> = {}): ProjectEntry {
  return {
    ...listed,
    path,
    status: 'ok',
    profile: ref,
    errors: 0,
    warnings: 0,
    summary: undefined,
    preview: undefined,
    ...over,
  }
}

describe("searchWords, as the kit's search reads them", () => {
  const search = (list: readonly ProjectEntry[], query: string) => filterEntries(list, query, searchWords)
  const entries: ProjectEntry[] = [
    ok('mossgate.af2d.json', { summary: { title: 'Mossgate', facts: [] } }),
    ok('notes/Harbour.note', { profile: note, summary: { title: 'Harbour Notes', facts: [] } }),
    { ...listed, path: 'bad.af2d.json', status: 'broken', profile: ref, message: 'x' },
    { ...listed, path: 'both.dat', status: 'ambiguous', candidates: [ref, note] },
  ]

  it('matches the path, the title and the profile label, ignoring case', () => {
    expect(search(entries, 'MOSS').map((e) => e.path)).toEqual(['mossgate.af2d.json'])
    expect(search(entries, 'harbour').map((e) => e.path)).toEqual(['notes/Harbour.note'])
    expect(search(entries, 'planted').map((e) => e.path)).toEqual(['notes/Harbour.note', 'both.dat'])
    expect(search(entries, 'level project').map((e) => e.path)).toEqual([
      'mossgate.af2d.json',
      'bad.af2d.json',
      'both.dat',
    ])
  })

  it('finds a project by the name it gives itself when the file is named something else', () => {
    const renamed = [ok('copy-of-3.af2d.json', { summary: { title: 'Mossgate', facts: [] } })]
    expect(search(renamed, 'mossgate')).toEqual(renamed)
  })

  it('needs every word of the query to match somewhere in the entry', () => {
    expect(search(entries, 'planted harbour').map((e) => e.path)).toEqual(['notes/Harbour.note'])
    expect(search(entries, 'moss harbour')).toEqual([])
  })

  it('keeps the order of the list and finds nothing for a word that is nowhere', () => {
    expect(search(entries, 'af2d').map((e) => e.path)).toEqual(['mossgate.af2d.json', 'bad.af2d.json'])
    expect(search(entries, 'zebra')).toEqual([])
  })
})

describe('entryBadge', () => {
  it('calls a project with no findings valid', () => {
    expect(entryBadge(ok('a'))).toEqual({ tone: 'ok', text: 'Valid' })
  })

  it('counts warnings, and errors first when there are both', () => {
    expect(entryBadge(ok('a', { warnings: 1 }))).toEqual({ tone: 'warn', text: '1 warning' })
    expect(entryBadge(ok('a', { warnings: 3 }))).toEqual({ tone: 'warn', text: '3 warnings' })
    expect(entryBadge(ok('a', { errors: 1 }))).toEqual({ tone: 'bad', text: '1 error' })
    expect(entryBadge(ok('a', { errors: 2, warnings: 1 }))).toEqual({
      tone: 'bad',
      text: '2 errors · 1 warning',
    })
  })

  it('says a broken file will not open and an ambiguous one needs a choice', () => {
    expect(entryBadge({ ...listed, path: 'x', status: 'broken', profile: ref, message: 'm' })).toEqual({
      tone: 'bad',
      text: 'Can’t open',
    })
    expect(entryBadge({ ...listed, path: 'x', status: 'ambiguous', candidates: [ref, note] })).toEqual({
      tone: 'neutral',
      text: 'Choose a profile',
    })
  })
})

describe('kindTone', () => {
  it('gives each registered profile its own accent by position, and the same one every time', () => {
    const registry = createAppProfiles()
    registry.register(plantedProfile())
    registry.register(plantedProfile({ id: 'third', label: 'Third' }))
    const tones = registry.list().map((profile) => kindTone(registry, profile.id))
    expect(new Set(tones).size).toBe(3)
    expect(kindTone(registry, 'planted')).toBe(tones[1])
  })

  it('wraps after the last accent and uses the neutral one for a profile it does not know', () => {
    const registry = createProfileRegistry()
    for (let i = 0; i < 6; i += 1) registry.register(plantedProfile({ id: `p${i}`, label: `P${i}` }))
    expect(kindTone(registry, 'p4')).toBe(kindTone(registry, 'p0'))
    expect(kindTone(registry, 'p5')).toBe(kindTone(registry, 'p1'))
    expect(kindTone(registry, 'nobody')).toBe('--color-text-dim')
  })
})

describe('templateCards', () => {
  it('lists every template of every profile in registration order, with its hint', () => {
    const registry = createAppProfiles()
    expect(templateCards(registry).map((card) => [card.key, card.label, card.hint])).toEqual([
      ['level-project/platformer', 'Platformer', 'side view'],
      ['level-project/topdown-rpg', 'Top-down RPG', 'maps · NPCs'],
      ['level-project/blank', 'Blank', 'own layers'],
    ])
  })

  it('tags a card with its profile only when more than one profile is registered', () => {
    const registry = createAppProfiles()
    expect(templateCards(registry).every((card) => !card.tagged)).toBe(true)
    registry.register(plantedProfile())
    const cards = templateCards(registry)
    expect(cards.every((card) => card.tagged)).toBe(true)
    expect(cards.map((card) => card.profileLabel)).toEqual([
      'Level project',
      'Level project',
      'Level project',
      'Planted note',
      'Planted note',
    ])
    expect(cards.at(-1)).toMatchObject({ profileId: 'planted', id: 'two', hint: undefined })
  })
})

describe('duplicateMessage and importMessage', () => {
  it('say what was copied, where, and why not', () => {
    const copied: CopyOutcome = { status: 'copied', path: 'dir/a copy.note' }
    expect(duplicateMessage('dir/a.note', copied)).toEqual({ kind: 'ok', text: 'Copied to a copy.note.' })
    expect(duplicateMessage('a.note', { status: 'missing', path: 'a.note' })).toEqual({
      kind: 'error',
      text: 'a.note is no longer in this workspace.',
    })
    expect(
      duplicateMessage('a.note', {
        status: 'failed',
        path: 'a.note',
        reason: 'quota',
        message: 'Disk full.',
      }),
    ).toEqual({ kind: 'error', text: 'Could not copy a.note: Disk full.' })
  })

  it('say what was imported, under which name, and why a file was refused', () => {
    const imported: ImportOutcome = { status: 'imported', name: 'a.note', path: 'a.note' }
    expect(importMessage(imported)).toEqual({ kind: 'ok', text: 'Imported a.note.' })
    expect(importMessage({ status: 'imported', name: 'a.note', path: 'a 2.note' })).toEqual({
      kind: 'ok',
      text: 'Imported a.note as a 2.note.',
    })
    expect(importMessage({ status: 'refused', name: 'r.txt', reason: 'unrecognised' })).toEqual({
      kind: 'error',
      text: 'r.txt is not a project this editor opens.',
    })
    expect(importMessage({ status: 'refused', name: 'p.png', reason: 'notText' })).toEqual({
      kind: 'error',
      text: 'p.png is not a text file.',
    })
    expect(importMessage({ status: 'refused', name: 'h.json', reason: 'tooLarge' })).toEqual({
      kind: 'error',
      text: 'h.json is over the 16 MB limit.',
    })
    expect(
      importMessage({ status: 'failed', name: 'a.note', reason: 'quota', message: 'Disk full.' }),
    ).toEqual({
      kind: 'error',
      text: 'Could not import a.note: Disk full.',
    })
  })
})

describe('removeMessage and importNotices', () => {
  it('says which file was deleted, by its last path segment', () => {
    expect(removeMessage('dir/old.note')).toEqual({ kind: 'info', text: 'Deleted old.note.' })
  })

  it('reports one imported file as itself and several as a count', () => {
    const one: ImportOutcome = { status: 'imported', name: 'a.note', path: 'a.note' }
    expect(importNotices([one])).toEqual([{ kind: 'ok', text: 'Imported a.note.' }])
    const two: ImportOutcome = { status: 'imported', name: 'b.note', path: 'b.note' }
    expect(importNotices([one, two])).toEqual([{ kind: 'ok', text: 'Imported 2 files.' }])
  })

  it('gives every refused or failed file its own notice, after the imported ones', () => {
    const imported: ImportOutcome = { status: 'imported', name: 'a.note', path: 'a.note' }
    const refused: ImportOutcome = { status: 'refused', name: 'r.txt', reason: 'unrecognised' }
    const failed: ImportOutcome = { status: 'failed', name: 'f.note', reason: 'quota', message: 'Disk full.' }
    expect(importNotices([refused, imported, failed])).toEqual([
      { kind: 'ok', text: 'Imported a.note.' },
      { kind: 'error', text: 'r.txt is not a project this editor opens.' },
      { kind: 'error', text: 'Could not import f.note: Disk full.' },
    ])
  })

  it('says nothing for no files', () => {
    expect(importNotices([])).toEqual([])
  })
})

describe('cardTitle', () => {
  const listed = { path: 'notes/harbour.note', size: 1, mtime: 1 }

  it('is the profile’s own title for the project, else the file’s name', () => {
    const titled: ProjectEntry = {
      ...listed,
      status: 'ok',
      profile: ref,
      errors: 0,
      warnings: 0,
      summary: { title: 'Mossgate', facts: [] },
      preview: undefined,
    }
    expect(cardTitle(titled)).toBe('Mossgate')
    expect(cardTitle({ ...titled, summary: undefined })).toBe('harbour.note')
    expect(cardTitle({ ...listed, status: 'broken', profile: ref, message: 'x' })).toBe('harbour.note')
    expect(cardTitle({ ...listed, status: 'ambiguous', candidates: [ref, note] })).toBe('harbour.note')
  })
})

describe('homeCard', () => {
  const registry = createAppProfiles()
  registry.register(plantedProfile())
  const [first] = registry.list()
  if (first === undefined) throw new Error('the registry holds a profile')
  const project = { id: first.id, label: first.label }

  it('carries the title, badge, kind, accent, size and age a card shows', () => {
    const entry = ok('mossgate.af2d.json', {
      profile: project,
      warnings: 1,
      summary: { title: 'Mossgate', facts: [] },
    })
    expect(homeCard(entry, registry)).toEqual({
      path: 'mossgate.af2d.json',
      title: 'Mossgate',
      badge: { tone: 'warn', text: '1 warning' },
      kind: project.label,
      accent: kindTone(registry, project.id),
      size: 100,
      mtime: 0,
    })
  })

  it('leaves an undecided file without an accent, its kind the profiles that claim it', () => {
    const either: ProjectEntry = { ...listed, path: 'both.dat', status: 'ambiguous', candidates: [ref, note] }
    expect(homeCard(either, registry)).toMatchObject({
      kind: 'Level project or Planted note',
      accent: undefined,
    })
  })

  describe('the tile preview (ED2D.4c3b)', () => {
    const preview = { project: mossgate(), level: 'moss-steps', images: 'assets/terrain.png@1700' }
    const withPreview = ok('mossgate.af2d.json', { profile: project, size: 4300, mtime: 1700, preview })
    const fake = (answer: string | undefined) => {
      const thumbnail = vi.fn(async () => answer)
      const thumbnails: LevelThumbnails = { thumbnail, dispose: vi.fn() }
      return { thumbnail, thumbnails }
    }

    it('draws the entry’s level through the thumbnails, keyed by path, size, time and images', async () => {
      const { thumbnail, thumbnails } = fake('data:image/png;base64,AAAA')
      const card = homeCard(withPreview, registry, thumbnails)
      expect(card.preview?.key).toBe('mossgate.af2d.json|4300|1700|assets/terrain.png@1700')
      expect(thumbnail).not.toHaveBeenCalled()
      await expect(card.preview?.draw()).resolves.toBe('data:image/png;base64,AAAA')
      expect(thumbnail).toHaveBeenCalledWith(card.preview?.key, preview)
    })

    it('has none without the thumbnails or without a level to preview', () => {
      const { thumbnails } = fake(undefined)
      expect(homeCard(withPreview, registry).preview).toBeUndefined()
      expect(
        homeCard(ok('plain.af2d.json', { profile: project }), registry, thumbnails).preview,
      ).toBeUndefined()
    })
  })
})
