import { describe, expect, test } from 'vitest'
import type { ChangeSetSummary, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import { reviewModel } from './review-model'
import { draftShip } from './ship-draft'

const TUNING = 'content/tuning.toml'
const POSE = 'content/poses/wave.toml'
const FEEL = 'content/feel.toml'

const file = (path: string, gates: readonly string[]): WorkspaceFile => ({
  path,
  editor: 'tuner',
  gates,
  checks: ['content'],
  modes: ['edit'],
  writable: true,
})
const FILES = [file(TUNING, ['g-feel']), file(POSE, []), file(FEEL, ['g-audio'])]

const SUMMARY: ChangeSetSummary = {
  title: 'Faster bounce',
  branch: 'edit/faster-bounce',
  base: 'main',
  files: [FEEL, POSE, TUNING],
  created: [POSE],
  tokens: { used: 1200, cap: 50000 },
  writes: [
    { path: TUNING, before: 'speed = 6\n', after: 'speed = 7\n' },
    { path: FEEL, before: 'shake = 1\n', after: 'shake = 2\n' },
    { path: POSE, before: undefined, after: 'pose = 1\n' },
    { path: TUNING, before: 'speed = 7\n', after: 'speed = 8\n' },
    { path: FEEL, before: 'shake = 2\n', after: 'shake = 1\n' },
  ],
  checks: [
    { check: 'content', status: 'pass', findings: [] },
    {
      check: 'fair',
      status: 'fail',
      findings: [{ path: TUNING, line: 1, severity: 'error', message: 'too fast' }],
      before: [{ id: 'gap', label: 'Gap', value: 2.2, ok: true }],
      after: [{ id: 'gap', label: 'Gap', value: 0.4, ok: false }],
    },
  ],
}

const APPROVED = { id: 'g-feel', name: 'Feel review', decision: 'approved' as const, url: 'https://x/g-feel' }

describe('the Review desk model (spec §5 flow 10, §9 review-desk)', () => {
  test("each changed file's diff runs from its first before to its latest after; a file put back drops out", () => {
    const review = reviewModel(SUMMARY, FILES, [APPROVED])
    expect(
      review.files.map(({ path, created, before, after }) => ({ path, created, before, after })),
    ).toEqual([
      { path: POSE, created: true, before: undefined, after: 'pose = 1\n' },
      { path: TUNING, created: false, before: 'speed = 6\n', after: 'speed = 8\n' },
    ])
    expect(review.files[1]?.hunks[0]?.lines.map((line) => line.kind)).toEqual(['removed', 'added'])
  })

  test('checks keep their before and after measures; tokens and the change set are carried', () => {
    const review = reviewModel(SUMMARY, FILES, [APPROVED])
    expect(review.checks[1]).toMatchObject({
      check: 'fair',
      before: [{ value: 2.2 }],
      after: [{ value: 0.4 }],
    })
    expect(review).toMatchObject({
      title: 'Faster bounce',
      branch: 'edit/faster-bounce',
      tokens: { used: 1200 },
    })
  })

  test('an approved gate is still listed as reopened, with its decision and link', () => {
    expect(reviewModel(SUMMARY, FILES, [APPROVED]).gates).toEqual({ reopened: [APPROVED] })
  })

  test('gates not readable (or no gates port) list the reopened ids as unknown, with the reason', () => {
    expect(reviewModel(SUMMARY, FILES, { error: 'no records' }).gates).toEqual({
      reopened: [{ id: 'g-feel', name: 'g-feel', decision: 'unknown' }],
      unreadable: 'no records',
    })
    expect(reviewModel(SUMMARY, FILES, undefined).gates).toEqual({
      reopened: [{ id: 'g-feel', name: 'g-feel', decision: 'unknown' }],
      unreadable: 'Gates not readable',
    })
  })
})

describe('the Ship description (EDS-D10: drafted from the changes, the checks and the gates)', () => {
  test('lists the files, the checks with failing findings and the gates, and says gates need the owner', () => {
    const draft = draftShip(reviewModel(SUMMARY, FILES, [APPROVED]))
    expect(draft.title).toBe('Faster bounce')
    expect(draft.body).toBe(
      [
        '## Changes',
        '',
        `- \`${POSE}\` (new)`,
        `- \`${TUNING}\``,
        '',
        '## Checks',
        '',
        '- content: pass',
        '- fair: fail',
        `  - ${TUNING}:1 too fast`,
        '  - Gap: 2.2 → 0.4',
        '',
        '## Gates',
        '',
        '- Feel review (g-feel): approved before this change, reopened by it. https://x/g-feel',
        '',
        'Gates still need the owner: the editor records no decision.',
        '',
      ].join('\n'),
    )
  })

  test('an open gate has no decision yet', () => {
    const open = { id: 'g-feel', name: 'Feel review', decision: 'open' as const }
    expect(draftShip(reviewModel(SUMMARY, FILES, [open])).body).toContain(
      '- Feel review (g-feel): open, no decision yet.',
    )
  })

  test('no reopened gates say "No gates"; unreadable gates say "state unknown"', () => {
    const noGates = draftShip(
      reviewModel(
        { ...SUMMARY, writes: [{ path: POSE, before: undefined, after: 'pose = 1\n' }] },
        FILES,
        [],
      ),
    )
    expect(noGates.body).toContain('## Gates\n\nNo gates.\n')
    const unknown = draftShip(reviewModel(SUMMARY, FILES, { error: 'no records' }))
    expect(unknown.body).toContain('- g-feel: state unknown (no records)')
  })
})
