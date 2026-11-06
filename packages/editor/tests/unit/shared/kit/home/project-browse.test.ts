import { describe, expect, it } from 'vitest'
import {
  cardWords,
  filterEntries,
  type HomeCard,
  modifiedLabel,
  projectCount,
  reconcileSelection,
  sizeLabel,
  splitPath,
  stepSelection,
  storageNotes,
  workspaceSubtitle,
} from '#src/shared/kit/home/project-browse.ts'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import type { Workspace } from '#src/shared/kit/storage/workspace.ts'

// The words and rules of a project list both editors' Home share (moved from editor-2d's `home-model.test.ts`,
// ED3D.5c). Pure functions of cards and the workspace.

const card = (path: string, over: Partial<HomeCard> = {}): HomeCard => ({
  path,
  title: path.slice(path.lastIndexOf('/') + 1),
  badge: { tone: 'ok', text: 'Valid' },
  kind: 'Level project',
  accent: '--color-layer-tiles',
  size: 100,
  mtime: 0,
  ...over,
})

describe('filterEntries over cardWords', () => {
  const cards: HomeCard[] = [
    card('mossgate.af2d.json', { title: 'Mossgate' }),
    card('notes/Harbour.note', { title: 'Harbour Notes', kind: 'Planted note' }),
    card('bad.af2d.json'),
    card('both.dat', { kind: 'Level project or Planted note', accent: undefined }),
  ]
  const search = (query: string): string[] => filterEntries(cards, query, cardWords).map((c) => c.path)

  it('keeps every entry, as the same array, for an empty or blank query', () => {
    expect(filterEntries(cards, '', cardWords)).toBe(cards)
    expect(filterEntries(cards, '   ', cardWords)).toBe(cards)
  })

  it('matches the path, the title and the kind, ignoring case', () => {
    expect(search('MOSS')).toEqual(['mossgate.af2d.json'])
    expect(search('harbour')).toEqual(['notes/Harbour.note'])
    expect(search('planted')).toEqual(['notes/Harbour.note', 'both.dat'])
    expect(search('level project')).toEqual(['mossgate.af2d.json', 'bad.af2d.json', 'both.dat'])
  })

  it('finds a project by the name it gives itself when the file is named something else', () => {
    const renamed = [card('copy-of-3.af2d.json', { title: 'Mossgate' })]
    expect(filterEntries(renamed, 'mossgate', cardWords)).toEqual(renamed)
  })

  it('needs every word of the query to match somewhere in the entry, and keeps the list order', () => {
    expect(search('planted harbour')).toEqual(['notes/Harbour.note'])
    expect(search('moss harbour')).toEqual([])
    expect(search('af2d')).toEqual(['mossgate.af2d.json', 'bad.af2d.json'])
    expect(search('zebra')).toEqual([])
  })

  it('reads any entry through the words it is given', () => {
    const entries = [{ path: 'a.json', label: 'Depot' }]
    expect(filterEntries(entries, 'depot', (entry) => [entry.label])).toEqual(entries)
  })
})

describe('reconcileSelection', () => {
  const visible = [card('a'), card('b'), card('c')]

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
  const visible = [card('a'), card('b'), card('c')]

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

describe('storage notes', () => {
  const workspace = (over: Partial<Workspace> = {}): Workspace => ({
    store: createMemoryStore(),
    journal: createMemoryStore(),
    exports: { kind: 'download' } as Workspace['exports'],
    persistent: true,
    reason: undefined,
    ...over,
  })

  it('says autosave is on when the workspace keeps things on this device', () => {
    const notes = storageNotes(workspace())
    expect(notes.map((n) => n.tone)).toEqual(['ok', 'ok', 'info'])
    expect(notes[0]?.text).toBe('Autosave on')
    expect(notes[1]?.text).toBe('Kept in this browser’s private storage')
  })

  it('warns, with the browser’s reason, when nothing is kept on this device', () => {
    const notes = storageNotes(workspace({ persistent: false, reason: 'No private storage here.' }))
    expect(notes.map((n) => n.tone)).toEqual(['warn', 'warn', 'info'])
    expect(notes[0]?.text).toBe('Not saved on this device')
    expect(notes[1]?.text).toBe('No private storage here.')
    expect(notes[2]?.text).toMatch(/Export/)
  })

  it('leaves out the reason when the browser gave none', () => {
    expect(storageNotes(workspace({ persistent: false })).map((n) => n.tone)).toEqual(['warn', 'info'])
  })

  it('says a served checkout is the game’s files, not browser storage', () => {
    const served = workspace({ served: true })
    expect(storageNotes(served)[1]?.text).toBe('Saved in your game folder')
    expect(workspaceSubtitle(served, 2)).toBe('2 projects · game checkout')
  })

  it('subtitles the workspace row with a count and where it lives', () => {
    expect(workspaceSubtitle(workspace(), 4)).toBe('4 projects · browser storage')
    expect(workspaceSubtitle(workspace(), 1)).toBe('1 project · browser storage')
    expect(workspaceSubtitle(workspace(), 0)).toBe('No projects · browser storage')
    expect(workspaceSubtitle(workspace({ persistent: false }), 2)).toBe('2 projects · this session only')
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
