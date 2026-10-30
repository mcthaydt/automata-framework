import { describe, expect, test } from 'vitest'
import { CHANGE_SET_JOURNAL_FORMAT, changeSetJournalSchema } from './change-set-journal.schema'

const journal = {
  format: CHANGE_SET_JOURNAL_FORMAT,
  title: 'Faster',
  branch: 'edit/faster',
  base: 'main',
  files: ['content/tuning.toml'],
  created: [],
  tokens: { used: 400, cap: 200_000 },
}

describe('the change-set journal (af-change-set/1)', () => {
  test('a journal reads back as written', () => {
    expect(changeSetJournalSchema.parse(JSON.parse(JSON.stringify(journal)))).toEqual(journal)
  })

  test.each([
    ['a token count below zero', { ...journal, tokens: { used: -1, cap: 10 } }],
    ['a token count that is not whole', { ...journal, tokens: { used: 1.5, cap: 10 } }],
    ['another format', { ...journal, format: 'af-change-set/2' }],
    ['no created list', { ...journal, created: undefined }],
    ['an unknown key', { ...journal, extra: true }],
  ])('refuses %s', (_name, value) => {
    expect(changeSetJournalSchema.safeParse(value).success).toBe(false)
  })
})
