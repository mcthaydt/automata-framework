import { describe, expect, it } from 'vitest'
import { problemCounts } from '#src/features/suite/core/problem-counts.ts'
import type { CheckFinding } from '#src/shared/kit/ports/suite-ports.ts'

const finding = (path: string | undefined): CheckFinding => ({ path, message: 'wrong' }) as CheckFinding
const cards = [
  { editor: 'tuner', files: [{ path: 'tuning/a.toml' }] },
  { editor: 'levels', files: [{ path: 'levels/one.toml' }, { path: 'levels/two.toml' }] },
]

describe('problemCounts', () => {
  it('counts each finding once for the editor whose card holds the file', () => {
    expect(
      problemCounts(
        [finding('levels/one.toml'), finding('levels/two.toml'), finding('tuning/a.toml')],
        cards,
      ),
    ).toEqual({ levels: 2, tuner: 1 })
  })

  it('leaves out findings with no file or a file no card holds, and editors with no problem', () => {
    expect(problemCounts([finding(undefined), finding('elsewhere.toml')], cards)).toEqual({})
  })
})
