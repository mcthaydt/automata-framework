import { describe, expect, it } from 'vitest'
import { parseCheckArgs } from './check-args.ts'

describe('parseCheckArgs', () => {
  it('defaults to the working folder with every option off', () => {
    expect(parseCheckArgs([])).toEqual({
      ok: true,
      options: { dir: undefined, json: false, simOnly: false, csp: false, failFast: false },
    })
  })

  it('reads each flag and a folder in any order', () => {
    expect(parseCheckArgs(['--json', 'games/x', '--sim-only', '--csp', '--fail-fast'])).toEqual({
      ok: true,
      options: { dir: 'games/x', json: true, simOnly: true, csp: true, failFast: true },
    })
  })

  it('rejects an unknown flag and a second folder', () => {
    expect(parseCheckArgs(['--fast'])).toEqual({ ok: false, problem: 'unknown option --fast' })
    expect(parseCheckArgs(['a', 'b'])).toEqual({ ok: false, problem: 'unexpected argument b' })
  })
})
