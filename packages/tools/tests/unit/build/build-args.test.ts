import { describe, expect, it } from 'vitest'
import { parseBuildArgs } from '#src/features/build/build-args.ts'

// FR.3: `automata build [dir] [--debug]`. `--target` is M8.5's and is refused here, not ignored.

describe('parseBuildArgs', () => {
  it('builds the working folder for release by default', () => {
    expect(parseBuildArgs([])).toEqual({ ok: true, options: { dir: undefined, debug: false } })
  })

  it('takes a game folder and --debug', () => {
    expect(parseBuildArgs(['games/moss', '--debug'])).toEqual({
      ok: true,
      options: { dir: 'games/moss', debug: true },
    })
    expect(parseBuildArgs(['--debug'])).toEqual({ ok: true, options: { dir: undefined, debug: true } })
  })

  it('refuses an unknown option and a second folder, naming them', () => {
    expect(parseBuildArgs(['--target', 'web'])).toEqual({ ok: false, problem: 'unknown option --target' })
    expect(parseBuildArgs(['a', 'b'])).toEqual({ ok: false, problem: 'unexpected argument b' })
  })
})
