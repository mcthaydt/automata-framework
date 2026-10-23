import { describe, expect, test } from 'vitest'
import { encodeJournalEntry, journalPath, parseJournalEntry } from './journal-entry'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('journalPath', () => {
  test('is the document path with .autosave on the end, so the journal mirrors the workspace', () => {
    expect(journalPath('stages/floor-1.toml')).toBe('stages/floor-1.toml.autosave')
  })
})

describe('journal entry', () => {
  const entry = {
    path: 'stages/a.toml',
    savedAt: 1_700_000_001_234,
    baseMtime: 1_700_000_000_000,
    payload: '{"n":3}',
  }

  test('round-trips', () => {
    expect(parseJournalEntry(bytes(encodeJournalEntry(entry)))).toEqual(entry)
  })

  test('a document with no file yet has a null base', () => {
    const fresh = { ...entry, baseMtime: null }
    expect(parseJournalEntry(bytes(encodeJournalEntry(fresh)))).toEqual(fresh)
  })

  test('the payload keeps its text exactly, including quotes, newlines and non-ASCII', () => {
    const odd = { ...entry, payload: 'a "quoted"\nline ✓  ' }
    expect(parseJournalEntry(bytes(encodeJournalEntry(odd)))?.payload).toBe(odd.payload)
  })

  test('names its format, so a later version can tell it apart', () => {
    expect(JSON.parse(encodeJournalEntry(entry)).format).toBe('af-autosave/1')
  })

  test.each([
    ['not JSON', '{nope'],
    ['empty', ''],
    ['null', 'null'],
    ['an array', '[]'],
    ['a number', '3'],
    ['another format', JSON.stringify({ ...entry, format: 'af-autosave/2' })],
    ['no format', JSON.stringify(entry)],
  ])('refuses %s', (_name, text) => {
    expect(parseJournalEntry(bytes(text))).toBeUndefined()
  })

  test.each([
    ['path', 7],
    ['savedAt', '1'],
    ['savedAt', Number.NaN],
    ['baseMtime', '1'],
    ['payload', 5],
  ])('refuses a %s of the wrong kind (%j)', (key, value) => {
    const text = JSON.stringify({ format: 'af-autosave/1', ...entry, [key]: value })
    expect(parseJournalEntry(bytes(text))).toBeUndefined()
  })

  test('refuses a time that JSON can spell but a clock cannot have', () => {
    const text = '{"format":"af-autosave/1","path":"a","savedAt":1e999,"baseMtime":null,"payload":""}'
    expect(parseJournalEntry(bytes(text))).toBeUndefined()
    const base = '{"format":"af-autosave/1","path":"a","savedAt":1,"baseMtime":-1e999,"payload":""}'
    expect(parseJournalEntry(bytes(base))).toBeUndefined()
  })

  test.each(['path', 'savedAt', 'baseMtime', 'payload'])('refuses an entry without %s', (key) => {
    const { [key as keyof typeof entry]: _dropped, ...rest } = entry
    expect(parseJournalEntry(bytes(JSON.stringify({ format: 'af-autosave/1', ...rest })))).toBeUndefined()
  })
})
