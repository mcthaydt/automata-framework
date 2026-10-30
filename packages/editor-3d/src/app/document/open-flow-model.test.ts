import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../../profile/af-sector-profile'
import type { LevelProfile } from '../../profile/level-profile'
import type { OpenOutcome } from '../editor-app'
import {
  documentHeading,
  errorPanel,
  exportedMessage,
  heldSave,
  jsonPathLabel,
  needsPanel,
  type PanelOutcome,
  reformattedMessage,
  restoreRefused,
} from './open-flow-model'

// What the 3D editor's open and save flows say (plan ED3D.5c step 8; ED3D spec §11): the error panel with its JSON paths
// and Copy details, the held Save (ED3-o), the toasts. Plain functions over the app's outcomes.

const INSTALLED = ['af-sector', 'last-light-blockout']
const profile = afSectorProfile as LevelProfile<unknown>

describe('needsPanel', () => {
  it('is true for a file that is wrong in itself, and false for one that went or a store that refused', () => {
    const panel: OpenOutcome[] = [
      { status: 'invalid', path: 'a.json', profile, issues: [], installed: INSTALLED, text: '{}' },
      { status: 'unrecognised', path: 'a.json', reason: 'x', installed: INSTALLED, message: 'x', text: '{}' },
      { status: 'notText', path: 'a.json' },
      { status: 'tooLarge', path: 'a.json', bytes: 1 },
    ]
    for (const outcome of panel) expect(needsPanel(outcome), outcome.status).toBe(true)
    expect(needsPanel({ status: 'missing', path: 'a.json' })).toBe(false)
    expect(needsPanel({ status: 'storageFailed', path: 'a.json', reason: 'io', message: 'x' })).toBe(false)
  })
})

describe('jsonPathLabel', () => {
  it('dots the members and items, and calls the root the file', () => {
    expect(jsonPathLabel(['sectors', 0, 'floor'])).toBe('sectors.0.floor')
    expect(jsonPathLabel(['format'])).toBe('format')
    expect(jsonPathLabel([])).toBe('(file)')
  })
})

describe('errorPanel', () => {
  it('lists every schema issue with its JSON path, names the profile and the installed ones, and copies it all', () => {
    const outcome: PanelOutcome = {
      status: 'invalid',
      path: 'levels/depot.json',
      profile,
      issues: [
        { path: ['sectors', 0, 'floor'], message: 'Expected number, received string' },
        { path: [], message: 'Unexpected end of JSON' },
      ],
      installed: INSTALLED,
      text: '{}',
    }
    const panel = errorPanel(outcome)
    expect(panel.title).toBe('depot.json does not open')
    expect(panel.rows).toEqual([
      { path: 'sectors.0.floor', message: 'Expected number, received string' },
      { path: '(file)', message: 'Unexpected end of JSON' },
    ])
    expect(panel.note).toBe('Read as af-sector. This editor opens af-sector and last-light-blockout.')
    expect(panel.details).toBe(
      [
        'levels/depot.json does not open',
        'Profile: af-sector',
        'sectors.0.floor: Expected number, received string',
        '(file): Unexpected end of JSON',
        'Installed profiles: af-sector, last-light-blockout',
      ].join('\n'),
    )
  })

  it('names the format found for a newer major version (the profile’s own issue at format)', () => {
    const panel = errorPanel({
      status: 'invalid',
      path: 'depot.json',
      profile,
      issues: [{ path: ['format'], message: 'af-sector/2 is not a version this editor reads (af-sector/1)' }],
      installed: INSTALLED,
      text: '{}',
    })
    expect(panel.rows).toEqual([
      { path: 'format', message: 'af-sector/2 is not a version this editor reads (af-sector/1)' },
    ])
  })

  it('gives the registry’s reason for a file no profile recognises, with the installed profiles', () => {
    const panel = errorPanel({
      status: 'unrecognised',
      path: 'art/facility.json',
      reason: 'this is a Last Light facility file',
      installed: INSTALLED,
      message: 'this is a Last Light facility file. Installed profiles: af-sector, last-light-blockout.',
      text: '{}',
    })
    expect(panel.title).toBe('facility.json is not a level this editor opens')
    expect(panel.rows).toEqual([{ path: '(file)', message: 'this is a Last Light facility file' }])
    expect(panel.note).toBe('This editor opens af-sector and last-light-blockout.')
    expect(panel.details).toContain('Installed profiles: af-sector, last-light-blockout')
  })

  it('says a file is not text, or is over the limit, with its size', () => {
    expect(errorPanel({ status: 'notText', path: 'a/img.json' })).toMatchObject({
      title: 'img.json is not a text file',
      rows: [],
      note: undefined,
    })
    const large = errorPanel({ status: 'tooLarge', path: 'big.json', bytes: 20 * 1024 * 1024 })
    expect(large.title).toBe('big.json is too large to open')
    expect(large.rows).toEqual([{ path: '(file)', message: 'It is 20 MB; the limit is 16 MB.' }])
    expect(large.details).toBe('big.json is too large to open\n(file): It is 20 MB; the limit is 16 MB.')
  })
})

describe('heldSave', () => {
  it('says where the codec cannot write and why, in its own words', () => {
    expect(
      heldSave('levels/depot.json', {
        status: 'refused',
        path: ['sectors', 2, 'floor'],
        reason: 'unwritable-value',
        detail: '1e+21 has an exponent',
      }),
    ).toEqual({
      title: 'depot.json can’t be saved as it is written',
      path: 'sectors.2.floor',
      reason: '1e+21 has an exponent',
      message:
        'The editor keeps a file’s layout by changing only what you edited, and it cannot write this change that way. Nothing was written. Save reformatted rewrites the whole file in the editor’s layout; Export a copy downloads it and leaves the file alone.',
    })
  })
})

describe('the words of the flows', () => {
  it('heads a document with its file name over its path', () => {
    expect(documentHeading('levels/depot.json')).toEqual({ title: 'depot.json', file: 'levels/depot.json' })
  })

  it('a refused restore gives its first issue with its path', () => {
    expect(restoreRefused([{ path: ['sectors', 0], message: 'Required' }])).toBe(
      'The autosave no longer opens (sectors.0: Required). Discard it to go on with the file as it was last saved.',
    )
    expect(restoreRefused([])).toBe(
      'The autosave no longer opens. Discard it to go on with the file as it was last saved.',
    )
  })

  it('a reformatted save and an export say what happened', () => {
    expect(reformattedMessage('a/depot.json')).toBe('Saved depot.json reformatted.')
    expect(exportedMessage('depot.json')).toBe('Exported a copy as depot.json.')
  })
})
