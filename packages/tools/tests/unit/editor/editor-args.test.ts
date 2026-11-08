import { describe, expect, it } from 'vitest'
import { parseEditorArgs } from '#src/features/editor/editor-args.ts'

// `automata editor [dir] [--app-dir <dir>] [--port <n>] [--lan] [--token <t>] [--game-url <url>]`: the game's editor list
// picks the page, so `--app` is gone (plan task 15.2).

describe('parseEditorArgs', () => {
  it('defaults to the working folder, the loopback and a free port', () => {
    expect(parseEditorArgs([])).toEqual({
      ok: true,
      options: {
        dir: '.',
        appDir: undefined,
        port: 0,
        lan: false,
        token: undefined,
        gameUrl: 'http://localhost:5173/',
      },
    })
  })

  it('takes a game folder, a port, --lan and a token', () => {
    expect(parseEditorArgs(['../game', '--port', '4173', '--lan', '--token', 'abc'])).toEqual({
      ok: true,
      options: {
        dir: '../game',
        appDir: undefined,
        port: 4173,
        lan: true,
        token: 'abc',
        gameUrl: 'http://localhost:5173/',
      },
    })
  })

  it('takes an explicit build folder', () => {
    expect(parseEditorArgs(['--app-dir', 'dist'])).toMatchObject({ ok: true, options: { appDir: 'dist' } })
  })

  it("takes the game's dev page, which the Tuner shows beside its settings", () => {
    expect(parseEditorArgs(['--game-url', 'http://localhost:5180'])).toMatchObject({
      ok: true,
      options: { gameUrl: 'http://localhost:5180/' },
    })
  })

  it.each([
    [['--game-url', 'localhost:5180'], /--game-url is a web address, like http:\/\/localhost:5173/],
    [['--game-url', 'file:///game/index.html'], /--game-url is a web address/],
    [['--app', 'suite'], /This option is gone: automata editor picks the editors your game needs\./],
    [['--app'], /This option is gone/],
    [['--port', 'x'], /--port is a number/],
    [['--port', '70000'], /--port is a number/],
    [['--port'], /--port needs a value/],
    [['--wat'], /unknown option --wat/],
    [['a', 'b'], /unexpected argument b/],
    [['--token', ''], /--token needs a value/],
  ])('refuses %j', (args, problem) => {
    const parsed = parseEditorArgs(args)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.problem).toMatch(problem)
  })
})
