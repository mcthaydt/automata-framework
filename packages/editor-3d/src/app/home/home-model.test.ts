import { describe, expect, it } from 'vitest'
import type { ProjectEntry } from '../project-list'
import { importNotice, levelCard, openProblem, searchWords, summaryOf } from './home-model'

// What the 3D editor's Home says (plan ED3D.5c step 7): how a level or a facility reads on its card and in the
// summary, and the toasts of an open or an import. The kit draws the cards and runs the list.

const INSTALLED = ['af-sector', 'last-light-blockout']
const listed = { size: 2048, mtime: 1_700_000_000_000 }
const level = (over: Partial<Extract<ProjectEntry, { kind: 'level'; status: 'ok' }>> = {}): ProjectEntry => ({
  ...listed,
  path: 'depot/depot.json',
  kind: 'level',
  status: 'ok',
  profile: 'af-sector',
  errors: 0,
  warnings: 0,
  ...over,
})
const broken: ProjectEntry = {
  ...listed,
  path: 'clinic/blockout.json',
  kind: 'level',
  status: 'broken',
  profile: 'last-light-blockout',
  message: 'rooms.0.floor: Expected number',
}
const facility: ProjectEntry = {
  ...listed,
  path: 'art/blockout-facility/facility.json',
  kind: 'facility',
  status: 'ok',
}
const brokenFacility: ProjectEntry = { ...facility, status: 'broken', message: 'wings: Required' }

describe('levelCard', () => {
  it('names a level by its file, its kind by its profile, coloured by the profile’s place among the installed', () => {
    expect(levelCard(level(), INSTALLED)).toEqual({
      path: 'depot/depot.json',
      title: 'depot.json',
      badge: { tone: 'ok', text: 'Valid' },
      kind: 'af-sector',
      accent: '--color-layer-tiles',
      size: 2048,
      mtime: listed.mtime,
    })
    expect(levelCard(level({ profile: 'last-light-blockout' }), INSTALLED).accent).toBe('--color-layer-sky')
    expect(levelCard(level({ profile: 'elsewhere' }), INSTALLED).accent).toBe('--color-text-dim')
  })

  it('counts what the checks found, errors first', () => {
    expect(levelCard(level({ warnings: 2 }), INSTALLED).badge).toEqual({ tone: 'warn', text: '2 warnings' })
    expect(levelCard(level({ errors: 1 }), INSTALLED).badge).toEqual({ tone: 'bad', text: '1 error' })
    expect(levelCard(level({ errors: 2, warnings: 1 }), INSTALLED).badge).toEqual({
      tone: 'bad',
      text: '2 errors · 1 warning',
    })
  })

  it('says a broken level or facility cannot be opened', () => {
    expect(levelCard(broken, INSTALLED).badge).toEqual({ tone: 'bad', text: 'Can’t open' })
    expect(levelCard(brokenFacility, INSTALLED).badge).toEqual({ tone: 'bad', text: 'Can’t open' })
  })

  it('gives a facility its own kind and colour, and says it opens with a level', () => {
    expect(levelCard(facility, INSTALLED)).toMatchObject({
      title: 'facility.json',
      kind: 'Facility',
      accent: '--color-layer-city',
      badge: { tone: 'neutral', text: 'Opens with a level' },
    })
  })
})

describe('searchWords', () => {
  it('are the path, the title and the kind', () => {
    expect(searchWords(level())).toEqual(['depot/depot.json', 'depot.json', 'af-sector'])
    expect(searchWords(facility)).toEqual([
      'art/blockout-facility/facility.json',
      'facility.json',
      'Facility',
    ])
  })
})

describe('summaryOf', () => {
  it('gives a level’s check counts and lets it open', () => {
    expect(summaryOf(level({ errors: 1, warnings: 3 }))).toEqual({
      facts: [
        { label: 'Profile', value: 'af-sector' },
        { label: 'Errors', value: '1' },
        { label: 'Warnings', value: '3' },
      ],
      reason: undefined,
      openable: true,
    })
  })

  it('gives a broken level its first problem and still lets it open, where the error panel shows all of them', () => {
    expect(summaryOf(broken)).toMatchObject({ reason: 'rooms.0.floor: Expected number', openable: true })
  })

  it('does not open a facility on its own, and says why', () => {
    expect(summaryOf(facility)).toMatchObject({
      openable: false,
      reason: 'A facility opens with one of its levels: open a level beside it.',
    })
    expect(summaryOf(brokenFacility)).toMatchObject({ openable: false, reason: 'wings: Required' })
  })
})

describe('openProblem', () => {
  it('says a file is gone, or what the store said', () => {
    expect(openProblem({ status: 'missing', path: 'depot/depot.json' })).toBe(
      'depot.json is no longer in this workspace.',
    )
    expect(
      openProblem({
        status: 'storageFailed',
        path: 'depot/depot.json',
        message: 'No access.',
      }),
    ).toBe('depot.json: No access.')
  })
})

describe('importNotice', () => {
  it('says what was imported and under which folder, and how many files were left out', () => {
    expect(
      importNotice({
        status: 'imported',
        root: 'clinic',
        files: ['clinic/a.json', 'clinic/b.png'],
        skipped: [],
      }),
    ).toEqual({
      kind: 'ok',
      text: 'Imported 2 files into clinic.',
    })
    expect(
      importNotice({
        status: 'imported',
        root: 'clinic 2',
        files: ['clinic 2/a.json'],
        skipped: [
          { path: 'clinic/.DS_Store', reason: 'system' },
          { path: 'clinic/huge.png', reason: 'tooLarge' },
        ],
      }),
    ).toEqual({
      kind: 'warn',
      text: 'Imported 1 file into clinic 2; 2 left out (system files, unsafe names or over 16 MB).',
    })
  })

  it('passes on why an import was refused, and what was written before a store refused', () => {
    expect(
      importNotice({ status: 'refused', reason: 'notZip', message: 'Not a zip file: bad header' }),
    ).toEqual({
      kind: 'error',
      text: 'Not a zip file: bad header',
    })
    expect(
      importNotice({
        status: 'failed',
        root: 'clinic',
        written: ['clinic/a.json'],
        reason: 'quota',
        message: 'Full.',
      }),
    ).toEqual({ kind: 'error', text: 'The import into clinic stopped after 1 file: Full.' })
  })
})
