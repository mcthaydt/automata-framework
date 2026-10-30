import { describe, expect, it } from 'vitest'
import { counterIds } from '../../model/ids'
import type { ParseError, Profile } from '../../profiles/profile'
import { plantedProfile } from '../../testing/planted-profile'
import { mossgate } from '../../testing/samples'
import type { OpenOutcome } from '../editor-app'
import { createAppProfiles } from '../profiles'
import {
  autosaveProblem,
  documentHeading,
  errorPanel,
  needsPanel,
  type PanelOutcome,
  recoveryUnreadable,
  reloadedMessage,
  restoreRefused,
  savedCopyMessage,
  saveFailure,
  textWindow,
} from './open-flow-model'

// What the open flows decide before anything is drawn (plan ED2D.4c2b, decisions 1 to 3, 5 and 6): which outcome gets
// the error panel, what it says, which lines of the file it shows, and the words of the recovery and save flows.

const profile = plantedProfile() as Profile<unknown>
const invalid = (
  errors: readonly ParseError[],
  text = '{\n  "format": "af2d",\n  "version": 3\n}\n',
): PanelOutcome => ({
  status: 'invalid',
  path: 'levels/mossgate.af2d.json',
  profile,
  errors,
  text,
})

describe('needsPanel', () => {
  const others: OpenOutcome[] = [
    { status: 'missing', path: 'a.af2d.json' },
    { status: 'storageFailed', path: 'a.af2d.json', reason: 'denied', message: 'No.' },
    { status: 'choose', path: 'a.note', candidates: [profile, profile], text: 'NOTE\n' },
  ]
  it('is true for the four outcomes a person has to look at', () => {
    expect(needsPanel(invalid([]))).toBe(true)
    expect(needsPanel({ status: 'unrecognised', path: 'a.txt', text: 'hello' })).toBe(true)
    expect(needsPanel({ status: 'notText', path: 'a.png' })).toBe(true)
    expect(needsPanel({ status: 'tooLarge', path: 'a.af2d.json', bytes: 20_000_000 })).toBe(true)
  })
  it('is false for a missing file, a store that refused and a choice', () => {
    for (const outcome of others) expect(needsPanel(outcome)).toBe(false)
  })
})

describe('errorPanel', () => {
  it('an invalid file: the file name in the heading, each error with where it is, the text and its error lines', () => {
    const panel = errorPanel(
      invalid([
        { code: 'notJson', message: 'Not JSON.', line: 3, column: 14 },
        { code: 'x', message: 'Only a line.', line: 2 },
        { code: 'y', message: 'At a key.', path: 'levels[a].size' },
        { code: 'z', message: 'Nowhere.' },
        { code: 'w', message: 'Same line again.', line: 3, column: 1 },
      ]),
    )
    expect(panel.title).toBe('mossgate.af2d.json does not open')
    expect(panel.problems).toEqual([
      { text: 'Not JSON.', where: 'line 3, column 14' },
      { text: 'Only a line.', where: 'line 2' },
      { text: 'At a key.', where: 'levels[a].size' },
      { text: 'Nowhere.', where: undefined },
      { text: 'Same line again.', where: 'line 3, column 1' },
    ])
    expect(panel.text).toBe('{\n  "format": "af2d",\n  "version": 3\n}\n')
    expect(panel.lines).toEqual([2, 3])
  })

  it('a newer file and unknown keys are worded by the profile (G-o, G-p): one problem per key path', () => {
    const registry = createAppProfiles()
    const level = registry.list()[0] as Profile<unknown>
    const newer = level.parse(JSON.stringify({ format: 'af2d', version: 99 }))
    if (newer.ok) throw new Error('a newer file must not parse')
    const panel = errorPanel(invalid(newer.error))
    expect(panel.problems).toHaveLength(1)
    expect(panel.problems[0]?.text).toMatch(/newer editor/)

    const keys = errorPanel(
      invalid([
        { code: 'k', message: '"extra" is not a key this editor knows.', path: 'extra' },
        { code: 'k', message: '"more" is not a key this editor knows.', path: 'more' },
      ]),
    )
    expect(keys.problems.map((problem) => problem.where)).toEqual(['extra', 'more'])
    expect(keys.lines).toEqual([])
  })

  it('a file no profile claims keeps its text, with one problem saying so', () => {
    const panel = errorPanel({ status: 'unrecognised', path: 'notes/todo.txt', text: 'buy milk' })
    expect(panel.title).toBe('todo.txt is not a project this editor opens')
    expect(panel.problems).toEqual([
      {
        text: 'None of the kinds of file this editor opens matches its name or its contents.',
        where: undefined,
      },
    ])
    expect(panel.text).toBe('buy milk')
  })

  it('a file that is not text, or too large, has no text view', () => {
    const binary = errorPanel({ status: 'notText', path: 'art.png' })
    expect(binary.title).toBe('art.png is not a text file')
    expect(binary.text).toBeUndefined()
    expect(binary.problems).toEqual([{ text: 'Its bytes are not UTF-8 text.', where: undefined }])
    const large = errorPanel({ status: 'tooLarge', path: 'big.af2d.json', bytes: 20 * 1024 * 1024 })
    expect(large.title).toBe('big.af2d.json is too large to open')
    expect(large.problems).toEqual([
      { text: 'It is 20 MB; the editor opens files up to 16 MB.', where: undefined },
    ])
    expect(large.text).toBeUndefined()
    expect(large.lines).toEqual([])
  })
})

describe('textWindow', () => {
  const numbered = (n: number): string => Array.from({ length: n }, (_, at) => `line ${at + 1}`).join('\n')

  it('a short file is all of it, and a final newline is not one more line', () => {
    expect(textWindow('a\nb\n')).toEqual({ first: 1, lines: ['a', 'b'], total: 2 })
    expect(textWindow('a\r\nb')).toEqual({ first: 1, lines: ['a', 'b'], total: 2 })
  })

  it('an empty file has no lines', () => {
    expect(textWindow('')).toEqual({ first: 1, lines: [], total: 0 })
  })

  it('a long file shows its first lines when nothing needs looking at further down', () => {
    const window = textWindow(numbered(1000), undefined, 10)
    expect(window).toEqual({ first: 1, lines: numbered(10).split('\n'), total: 1000 })
    expect(textWindow(numbered(1000), 10, 10).first).toBe(1)
  })

  it('a focus further down centres the window on it, kept inside the file', () => {
    expect(textWindow(numbered(1000), 500, 10)).toMatchObject({ first: 495, total: 1000 })
    expect(textWindow(numbered(1000), 500, 10).lines[0]).toBe('line 495')
    expect(textWindow(numbered(1000), 999, 10)).toMatchObject({ first: 991 })
    expect(textWindow(numbered(1000), 999, 10).lines).toHaveLength(10)
    expect(textWindow(numbered(1000), 11, 10).first).toBe(6)
  })

  it('a focus past the end of a short file shows the whole file', () => {
    expect(textWindow('a\nb', 50, 10)).toEqual({ first: 1, lines: ['a', 'b'], total: 2 })
  })

  it('draws 400 lines by default', () => {
    expect(textWindow(numbered(1000)).lines).toHaveLength(400)
  })
})

describe('documentHeading', () => {
  it('is the profile’s own title for the document over its path', () => {
    const level = createAppProfiles().list()[0] as Profile<unknown>
    expect(documentHeading(level, mossgate(counterIds()), 'mossgate.af2d.json')).toEqual({
      title: 'Mossgate',
      file: 'mossgate.af2d.json',
    })
  })
  it('is the file name for a profile without a summary', () => {
    expect(documentHeading(profile, { text: 'x' }, 'notes/a.note')).toEqual({
      title: 'a.note',
      file: 'notes/a.note',
    })
  })
})

describe('messages', () => {
  it('a failed save names the file and the store’s reason', () => {
    expect(
      saveFailure('a/b.af2d.json', { status: 'failed', reason: 'quota', message: 'The disk is full.' }),
    ).toBe('Could not save b.af2d.json: The disk is full.')
  })
  it('a copy names the copy', () => {
    expect(savedCopyMessage('a/b copy.af2d.json')).toBe('Saved a copy as b copy.af2d.json.')
  })
  it('a refused restore says why and that the file is open as saved', () => {
    expect(restoreRefused([{ code: 'x', message: 'Not JSON.' }])).toBe(
      'The autosave no longer opens (Not JSON.). Discard it to go on with the file as it was last saved.',
    )
    expect(restoreRefused([])).toBe(
      'The autosave no longer opens. Discard it to go on with the file as it was last saved.',
    )
  })
  it('an autosave that stopped asks for a save; one that failed once says so', () => {
    expect(
      autosaveProblem({ source: 'autosave', reason: 'quota', message: 'The disk is full.', paused: true }),
    ).toBe('Autosave has stopped: The disk is full. Save to keep your edits.')
    expect(autosaveProblem({ source: 'autosave', reason: 'io', message: 'It broke.', paused: false })).toBe(
      'Autosave failed: It broke. It tries again with the next edit.',
    )
  })
  it('an unreadable autosave and a reload name what happened', () => {
    expect(recoveryUnreadable('Gone.')).toBe(
      'The autosave could not be read (Gone.). The file is open as it was last saved.',
    )
    expect(reloadedMessage('x/a.note')).toBe('Reloaded a.note from the file.')
  })
})
