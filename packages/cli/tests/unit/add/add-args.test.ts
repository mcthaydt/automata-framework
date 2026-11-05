import { describe, expect, it } from 'vitest'
import { PLUS_REPOSITORY, parseAddArgs } from './add-args.ts'

describe('parseAddArgs', () => {
  it('needs a kit name', () => {
    expect(parseAddArgs([])).toEqual({ ok: false, problem: 'a kit name is required' })
    expect(parseAddArgs(['--force'])).toEqual({ ok: false, problem: 'a kit name is required' })
  })

  it('defaults to the working folder, the Plus repository and no --force', () => {
    expect(parseAddArgs(['lobby'])).toEqual({
      ok: true,
      options: { kit: 'lobby', dir: '.', repo: PLUS_REPOSITORY, force: false },
    })
    expect(PLUS_REPOSITORY).toBe('https://github.com/mcthaydt/automata-plus.git')
  })

  it('reads --dir, --repo and --force in any order', () => {
    expect(
      parseAddArgs(['--force', 'results-screen', '--repo', 'file:///tmp/plus.git', '--dir', 'games/x']),
    ).toEqual({
      ok: true,
      options: { kit: 'results-screen', dir: 'games/x', repo: 'file:///tmp/plus.git', force: true },
    })
  })

  it('rejects an unknown flag, a flag without its value and a second kit', () => {
    expect(parseAddArgs(['lobby', '--fast'])).toEqual({ ok: false, problem: 'unknown option --fast' })
    expect(parseAddArgs(['lobby', '--dir'])).toEqual({ ok: false, problem: '--dir needs a value' })
    expect(parseAddArgs(['lobby', '--repo', '--force'])).toEqual({
      ok: false,
      problem: '--repo needs a value',
    })
    expect(parseAddArgs(['lobby', 'pause'])).toEqual({ ok: false, problem: 'unexpected argument pause' })
  })

  it('takes kit names by the game id rule, so a name is never a path', () => {
    for (const kit of ['../lobby', 'ui/lobby', 'Lobby', 'lobby_screen', '.git', 'lobby-']) {
      expect(parseAddArgs([kit]), kit).toEqual({
        ok: false,
        problem: `"${kit}" is not a kit name (lowercase letters, digits and single hyphens, such as results-screen)`,
      })
    }
  })
})
