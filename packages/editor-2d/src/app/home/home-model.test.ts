import { describe, expect, it } from 'vitest'
import { createProfileRegistry } from '../../profiles/profile'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { plantedProfile } from '../../testing/planted-profile'
import { createTestClock } from '../../testing/test-clock'
import type { CopyOutcome, ImportOutcome, OpenOutcome } from '../editor-app'
import { createAppProfiles } from '../profiles'
import type { ProjectEntry } from '../project-list'
import {
  cardTitle,
  duplicateMessage,
  entryBadge,
  filterProjects,
  importMessage,
  importNotices,
  kindTone,
  modifiedLabel,
  openProblem,
  projectCount,
  reconcileSelection,
  removeMessage,
  sizeLabel,
  splitPath,
  stepSelection,
  storageNotes,
  templateCards,
  workspaceSubtitle,
} from './home-model'

// What Home decides before anything is drawn (plan ED2D.4c2a step 4): pure functions of the list, the registry and the
// workspace. The components only show what these return.

const ref = { id: 'level-project', label: 'Level project' }
const note = { id: 'planted', label: 'Planted note' }
const listed = { size: 100, mtime: 0 }

function ok(path: string, over: Partial<Extract<ProjectEntry, { status: 'ok' }>> = {}): ProjectEntry {
  return { ...listed, path, status: 'ok', profile: ref, errors: 0, warnings: 0, summary: undefined, ...over }
}

describe('filterProjects', () => {
  const entries: ProjectEntry[] = [
    ok('mossgate.af2d.json', { summary: { title: 'Mossgate', facts: [] } }),
    ok('notes/Harbour.note', { profile: note, summary: { title: 'Harbour Notes', facts: [] } }),
    { ...listed, path: 'bad.af2d.json', status: 'broken', profile: ref, message: 'x' },
    { ...listed, path: 'both.dat', status: 'ambiguous', candidates: [ref, note] },
  ]

  it('keeps every entry, as the same array, for an empty or blank query', () => {
    expect(filterProjects(entries, '')).toBe(entries)
    expect(filterProjects(entries, '   ')).toBe(entries)
  })

  it('matches the path, the title and the profile label, ignoring case', () => {
    expect(filterProjects(entries, 'MOSS').map((e) => e.path)).toEqual(['mossgate.af2d.json'])
    expect(filterProjects(entries, 'harbour').map((e) => e.path)).toEqual(['notes/Harbour.note'])
    expect(filterProjects(entries, 'planted').map((e) => e.path)).toEqual(['notes/Harbour.note', 'both.dat'])
    expect(filterProjects(entries, 'level project').map((e) => e.path)).toEqual([
      'mossgate.af2d.json',
      'bad.af2d.json',
      'both.dat',
    ])
  })

  it('finds a project by the name it gives itself when the file is named something else', () => {
    const renamed = [ok('copy-of-3.af2d.json', { summary: { title: 'Mossgate', facts: [] } })]
    expect(filterProjects(renamed, 'mossgate')).toEqual(renamed)
  })

  it('needs every word of the query to match somewhere in the entry', () => {
    expect(filterProjects(entries, 'planted harbour').map((e) => e.path)).toEqual(['notes/Harbour.note'])
    expect(filterProjects(entries, 'moss harbour')).toEqual([])
  })

  it('keeps the order of the list and finds nothing for a word that is nowhere', () => {
    expect(filterProjects(entries, 'af2d').map((e) => e.path)).toEqual([
      'mossgate.af2d.json',
      'bad.af2d.json',
    ])
    expect(filterProjects(entries, 'zebra')).toEqual([])
  })
})

describe('reconcileSelection', () => {
  const visible = [ok('a'), ok('b'), ok('c')]

  it('keeps a selection that is still shown', () => {
    expect(reconcileSelection(visible, 'b')).toBe('b')
  })

  it('falls to the first entry when the selection is gone or there was none', () => {
    expect(reconcileSelection(visible, 'zzz')).toBe('a')
    expect(reconcileSelection(visible, undefined)).toBe('a')
  })

  it('selects nothing when nothing is shown', () => {
    expect(reconcileSelection([], 'a')).toBeUndefined()
  })
})

describe('stepSelection', () => {
  const visible = [ok('a'), ok('b'), ok('c')]

  it('moves forward with right and down, and back with left and up', () => {
    expect(stepSelection(visible, 'b', 'ArrowRight')).toBe('c')
    expect(stepSelection(visible, 'b', 'ArrowDown')).toBe('c')
    expect(stepSelection(visible, 'b', 'ArrowLeft')).toBe('a')
    expect(stepSelection(visible, 'b', 'ArrowUp')).toBe('a')
  })

  it('stops at the ends instead of wrapping', () => {
    expect(stepSelection(visible, 'c', 'ArrowRight')).toBe('c')
    expect(stepSelection(visible, 'a', 'ArrowLeft')).toBe('a')
  })

  it('jumps to the ends with Home and End', () => {
    expect(stepSelection(visible, 'b', 'Home')).toBe('a')
    expect(stepSelection(visible, 'b', 'End')).toBe('c')
  })

  it('starts at the first entry going forward and the last going back when nothing is selected', () => {
    expect(stepSelection(visible, undefined, 'ArrowDown')).toBe('a')
    expect(stepSelection(visible, 'gone', 'ArrowRight')).toBe('a')
    expect(stepSelection(visible, undefined, 'ArrowUp')).toBe('c')
    expect(stepSelection(visible, undefined, 'ArrowLeft')).toBe('c')
  })

  it('selects nothing in an empty list', () => {
    expect(stepSelection([], undefined, 'Home')).toBeUndefined()
  })
})

describe('modifiedLabel', () => {
  const now = Date.UTC(2026, 9, 23, 12, 0, 0)
  const ago = (ms: number): string => modifiedLabel(now - ms, now, 'UTC')
  const SECOND = 1000
  const MINUTE = 60 * SECOND
  const HOUR = 60 * MINUTE

  it('says just now for under a minute, and for a time slightly ahead of the clock', () => {
    expect(ago(0)).toBe('just now')
    expect(ago(59 * SECOND)).toBe('just now')
    expect(ago(-5 * MINUTE)).toBe('just now')
  })

  it('counts minutes up to an hour and hours up to a day', () => {
    expect(ago(MINUTE)).toBe('1 min ago')
    expect(ago(59 * MINUTE + 59 * SECOND)).toBe('59 min ago')
    expect(ago(HOUR)).toBe('1 h ago')
    expect(ago(23 * HOUR + 59 * MINUTE)).toBe('23 h ago')
  })

  it('says yesterday for the day before and then gives the date', () => {
    expect(ago(24 * HOUR)).toBe('yesterday')
    expect(ago(47 * HOUR + 59 * MINUTE)).toBe('yesterday')
    expect(ago(48 * HOUR)).toBe('Oct 21')
    expect(modifiedLabel(Date.UTC(2026, 0, 3, 8), now, 'UTC')).toBe('Jan 3')
  })

  it('adds the year when it is not this one', () => {
    expect(modifiedLabel(Date.UTC(2025, 11, 31, 8), now, 'UTC')).toBe('Dec 31, 2025')
  })

  it('reads the date in the time zone it is given', () => {
    const lateEvening = Date.UTC(2026, 9, 20, 23, 30)
    expect(modifiedLabel(lateEvening, now, 'UTC')).toBe('Oct 20')
    expect(modifiedLabel(lateEvening, now, 'Asia/Tokyo')).toBe('Oct 21')
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

describe('storage notes', () => {
  const clock = createTestClock()

  it('says autosave is on when the workspace keeps things on this device', () => {
    const notes = storageNotes(memoryWorkspace(clock))
    expect(notes.map((n) => n.tone)).toEqual(['ok', 'ok', 'info'])
    expect(notes[0]?.text).toBe('Autosave on')
    expect(notes[1]?.text).toBe('Kept in this browser’s private storage')
  })

  it('warns, with the browser’s reason, when nothing is kept on this device', () => {
    const volatile = { ...memoryWorkspace(clock), persistent: false, reason: 'No private storage here.' }
    const notes = storageNotes(volatile)
    expect(notes.map((n) => n.tone)).toEqual(['warn', 'warn', 'info'])
    expect(notes[0]?.text).toBe('Not saved on this device')
    expect(notes[1]?.text).toBe('No private storage here.')
    expect(notes[2]?.text).toMatch(/Export/)
  })

  it('leaves out the reason when the browser gave none', () => {
    const volatile = { ...memoryWorkspace(clock), persistent: false, reason: undefined }
    expect(storageNotes(volatile).map((n) => n.tone)).toEqual(['warn', 'info'])
  })

  it('subtitles the workspace row with a count and where it lives', () => {
    expect(workspaceSubtitle(memoryWorkspace(clock), 4)).toBe('4 projects · browser storage')
    expect(workspaceSubtitle(memoryWorkspace(clock), 1)).toBe('1 project · browser storage')
    expect(workspaceSubtitle(memoryWorkspace(clock), 0)).toBe('No projects · browser storage')
    expect(workspaceSubtitle({ ...memoryWorkspace(clock), persistent: false }, 2)).toBe(
      '2 projects · this session only',
    )
  })
})

describe('openProblem', () => {
  const problem = (outcome: Exclude<OpenOutcome, { status: 'opened' }>): string => openProblem(outcome)

  it('names the file by its last path segment and says what went wrong', () => {
    expect(problem({ status: 'unrecognised', path: 'dir/readme.txt', text: 'hi' })).toBe(
      'readme.txt is not a project this editor opens.',
    )
    expect(problem({ status: 'notText', path: 'dir/pic.png' })).toBe('pic.png is not a text file.')
    expect(problem({ status: 'missing', path: 'gone.af2d.json' })).toBe(
      'gone.af2d.json is no longer in this workspace.',
    )
    expect(problem({ status: 'tooLarge', path: 'huge.af2d.json', bytes: 20 * 1024 * 1024 })).toBe(
      'huge.af2d.json is 20 MB; the limit is 16 MB.',
    )
  })

  it('gives the first reason a file does not open, with its position when it has one', () => {
    const profile = createAppProfiles().list()[0]
    if (profile === undefined) throw new Error('no profile')
    expect(
      problem({
        status: 'invalid',
        path: 'a.af2d.json',
        profile,
        text: '{',
        errors: [
          { code: 'notJson', message: 'Unexpected end', line: 3, column: 7 },
          { code: 'x', message: 'y' },
        ],
      }),
    ).toBe('a.af2d.json does not open: Unexpected end (line 3, column 7).')
    expect(
      problem({
        status: 'invalid',
        path: 'a.af2d.json',
        profile,
        text: '{',
        errors: [{ code: 'newerVersion', message: 'Made by a newer editor.' }],
      }),
    ).toBe('a.af2d.json does not open: Made by a newer editor.')
    expect(problem({ status: 'invalid', path: 'a.af2d.json', profile, text: '', errors: [] })).toBe(
      'a.af2d.json does not open.',
    )
  })

  it('lists the kinds that claim a file that more than one profile claims', () => {
    const registry = createAppProfiles()
    registry.register(plantedProfile())
    expect(problem({ status: 'choose', path: 'x.dat', text: '', candidates: registry.list() })).toBe(
      'x.dat could be a Level project or a Planted note.',
    )
  })

  it('lists three candidates with commas and a last or', () => {
    const registry = createAppProfiles()
    registry.register(plantedProfile())
    registry.register(plantedProfile({ id: 'third', label: 'Third' }))
    expect(problem({ status: 'choose', path: 'x.dat', text: '', candidates: registry.list() })).toBe(
      'x.dat could be a Level project, a Planted note or a Third.',
    )
  })

  it('passes on what the store said', () => {
    expect(
      problem({ status: 'storageFailed', path: 'a.note', reason: 'denied', message: 'Not allowed' }),
    ).toBe('a.note: Not allowed')
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
    }
    expect(cardTitle(titled)).toBe('Mossgate')
    expect(cardTitle({ ...titled, summary: undefined })).toBe('harbour.note')
    expect(cardTitle({ ...listed, status: 'broken', profile: ref, message: 'x' })).toBe('harbour.note')
    expect(cardTitle({ ...listed, status: 'ambiguous', candidates: [ref, note] })).toBe('harbour.note')
  })
})

describe('splitPath', () => {
  it('splits a path into its folder, with the slash, and the file name', () => {
    expect(splitPath('notes/harbour.note')).toEqual({ dir: 'notes/', name: 'harbour.note' })
    expect(splitPath('a/b/c.json')).toEqual({ dir: 'a/b/', name: 'c.json' })
    expect(splitPath('mossgate.af2d.json')).toEqual({ dir: '', name: 'mossgate.af2d.json' })
  })
})

describe('sizeLabel', () => {
  it('reads bytes, kilobytes and megabytes with one decimal below ten', () => {
    expect(sizeLabel(0)).toBe('0 B')
    expect(sizeLabel(812)).toBe('812 B')
    expect(sizeLabel(1023)).toBe('1023 B')
    expect(sizeLabel(1024)).toBe('1.0 KB')
    expect(sizeLabel(4300)).toBe('4.2 KB')
    expect(sizeLabel(10 * 1024)).toBe('10 KB')
    expect(sizeLabel(512 * 1024)).toBe('512 KB')
    expect(sizeLabel(1024 * 1024)).toBe('1.0 MB')
    expect(sizeLabel(15.5 * 1024 * 1024)).toBe('16 MB')
  })
})

describe('projectCount', () => {
  it('says the workspace is empty', () => {
    expect(projectCount(0, 0, '')).toBe('No projects')
    expect(projectCount(0, 0, 'moss')).toBe('No projects')
  })

  it('counts the workspace when nothing is searched for', () => {
    expect(projectCount(1, 1, '')).toBe('1 in this workspace')
    expect(projectCount(4, 4, '   ')).toBe('4 in this workspace')
  })

  it('says how many of the workspace a search shows', () => {
    expect(projectCount(4, 2, 'moss')).toBe('2 of 4 shown')
    expect(projectCount(4, 0, 'zzz')).toBe('0 of 4 shown')
  })
})
