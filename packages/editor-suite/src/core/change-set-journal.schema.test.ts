import { describe, expect, test } from 'vitest'
import { CHANGE_SET_JOURNAL_FORMAT, changeSetJournalSchema } from './change-set-journal.schema'

const journal = {
  format: CHANGE_SET_JOURNAL_FORMAT,
  title: 'Faster',
  branch: 'edit/faster',
  base: 'main',
  files: ['content/feel/juice.toml', 'content/tuning.toml'],
  created: ['content/feel/juice.toml'],
  tokens: { used: 400, cap: 200_000 },
  writes: [
    { path: 'content/tuning.toml', before: 'MAX_MOVE_SPEED = 7\n', after: 'MAX_MOVE_SPEED = 8\n' },
    { path: 'content/feel/juice.toml', before: undefined, after: 'shake = 0.2\n' },
  ],
  checks: [
    {
      check: 'fairness',
      status: 'warn',
      findings: [{ path: 'content/tuning.toml', line: 1, severity: 'warning', message: 'close to the edge' }],
      before: [{ id: 'gap', label: 'Widest gap', value: 3, threshold: 4, ok: true }],
      after: [{ id: 'gap', label: 'Widest gap', value: 4, threshold: 4, ok: true }],
    },
  ],
}

describe('the change-set journal (af-change-set/2)', () => {
  test('a journal reads back as written, a created file keeping no before text', () => {
    expect(CHANGE_SET_JOURNAL_FORMAT).toBe('af-change-set/2')
    const read = changeSetJournalSchema.parse(JSON.parse(JSON.stringify(journal)))
    expect(read).toEqual(journal)
    expect(read.writes[1]).toHaveProperty('before', undefined)
  })

  test('an af-change-set/1 journal reads as one with no writes or checks', () => {
    const { writes: _writes, checks: _checks, ...rest } = journal
    expect(changeSetJournalSchema.parse({ ...rest, format: 'af-change-set/1' })).toEqual({
      ...rest,
      writes: [],
      checks: [],
    })
  })

  test.each([
    ['a token count below zero', { ...journal, tokens: { used: -1, cap: 10 } }],
    ['a token count that is not whole', { ...journal, tokens: { used: 1.5, cap: 10 } }],
    ['another format', { ...journal, format: 'af-change-set/3' }],
    ['no created list', { ...journal, created: undefined }],
    ['no writes', { ...journal, writes: undefined }],
    ['a check with an unknown status', { ...journal, checks: [{ check: 'x', status: 'ok', findings: [] }] }],
    ['an unknown key', { ...journal, extra: true }],
    ['an af-change-set/1 journal with writes', { ...journal, format: 'af-change-set/1' }],
  ])('refuses %s', (_name, value) => {
    expect(changeSetJournalSchema.safeParse(value).success).toBe(false)
  })
})
