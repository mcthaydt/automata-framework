import { describe, expect, it } from 'vitest'
import { parseEditorArgs } from '#src/features/editor/editor-args.ts'

// `automata editor [dir] [--app 2d|3d|suite] [--app-dir <dir>] [--port <n>] [--lan] [--token <t>]` (ED3D.14, ED2D.9).

describe('parseEditorArgs', () => {
  it('defaults to the editors page (Levels and the Tuner, with Play and Publish), the working folder, the loopback, a free port and a game it starts itself', () => {
    expect(parseEditorArgs([])).toEqual({
      ok: true,
      options: {
        dir: '.',
        app: 'suite',
        appDir: undefined,
        port: 0,
        lan: false,
        token: undefined,
        gameUrl: undefined,
      },
    })
  })

  it('takes a game folder, an app, a port, --lan and a token', () => {
    expect(
      parseEditorArgs(['../game', '--app', 'suite', '--port', '4173', '--lan', '--token', 'abc']),
    ).toEqual({
      ok: true,
      options: {
        dir: '../game',
        app: 'suite',
        appDir: undefined,
        port: 4173,
        lan: true,
        token: 'abc',
        gameUrl: undefined,
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
    [['--app', 'vr'], /--app is 2d, 3d or suite/],
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
