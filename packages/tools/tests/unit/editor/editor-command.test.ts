import { describe, expect, it, vi } from 'vitest'
import { type EditorCommandDeps, editorCommand, liveEditorDeps } from '#src/features/editor/editor-command.ts'
import type { EditorServerOptions } from '#src/features/editor/serve-editor.ts'

// `automata editor` (ED3D.14, ED2D.9): what it says, which build it serves, and when it will not start. The server itself
// is `serve-editor.test.ts`'s; here it is a stand-in that records what it was asked to serve.

function setup(overrides: Partial<EditorCommandDeps> = {}) {
  const out: string[] = []
  const err: string[] = []
  const served: EditorServerOptions[] = []
  const closed = vi.fn()
  const deps: EditorCommandDeps = {
    serve: async (options) => {
      served.push(options)
      return {
        url: `http://127.0.0.1:${options.port || 5000}`,
        port: options.port || 5000,
        close: async () => closed(),
      }
    },
    builtApp: (app) => `/repo/builds/${app}`,
    inRepository: true,
    exists: () => true,
    lanAddresses: () => ['192.168.1.20'],
    makeToken: () => 'tok123',
    untilStopped: async () => {},
    cwd: '/work',
    ...overrides,
  }
  const io = { stdout: (text: string) => out.push(text), stderr: (text: string) => err.push(text) }
  return { deps, io, out, err, served, closed }
}

describe('editorCommand', () => {
  it('serves the 2D editor against the working folder on the loopback and says where', async () => {
    const { deps, io, out, served, closed } = setup()
    expect(await editorCommand([], io, deps)).toBe(0)
    expect(served[0]).toMatchObject({
      root: '/work',
      appDir: '/repo/builds/2d',
      host: '127.0.0.1',
      token: undefined,
    })
    expect(out.join('')).toContain('http://127.0.0.1:5000')
    expect(closed).toHaveBeenCalled()
  })

  it('serves the app and the folder it was told', async () => {
    const { deps, io, served } = setup()
    await editorCommand(['../game', '--app', 'suite'], io, deps)
    expect(served[0]).toMatchObject({ root: '/game', appDir: '/repo/builds/suite' })
  })

  it("passes the game's dev page on to the server: Vite's own port unless told", async () => {
    const { deps, io, served } = setup()
    await editorCommand(['--app', 'suite'], io, deps)
    await editorCommand(['--app', 'suite', '--game-url', 'http://localhost:5180'], io, deps)
    expect(served.map((each) => each.gameUrl)).toEqual(['http://localhost:5173/', 'http://localhost:5180/'])
  })

  it('--lan listens on every address, makes a token, and prints the address a tablet opens with the token in it', async () => {
    const { deps, io, out, served } = setup()
    await editorCommand(['--lan', '--port', '4173'], io, deps)
    expect(served[0]).toMatchObject({ host: '0.0.0.0', port: 4173, token: 'tok123' })
    expect(out.join('')).toContain('http://192.168.1.20:4173/?token=tok123')
  })

  it('keeps the token it was given', async () => {
    const { deps, io, out, served } = setup()
    await editorCommand(['--lan', '--token', 'mine'], io, deps)
    expect(served[0]?.token).toBe('mine')
    expect(out.join('')).toContain('?token=mine')
  })

  it('says the 3D editor and the suite are not in this release when run outside the repository, and starts nothing', async () => {
    for (const [app, says] of [
      ['3d', 'The 3D editor is not in this release yet.'],
      ['suite', 'The editor suite is not in this release yet. Run automata editor to open the level editor.'],
    ] as const) {
      const { deps, io, err, served } = setup({ inRepository: false })
      expect(await editorCommand(['--app', app], io, deps)).toBe(2)
      expect(err.join('')).toContain(says)
      expect(served).toEqual([])
    }
  })

  it('serves a 3D build given with --app-dir even outside the repository', async () => {
    const { deps, io, served } = setup({ inRepository: false })
    expect(await editorCommand(['--app', '3d', '--app-dir', '/builds/mine'], io, deps)).toBe(0)
    expect(served[0]).toMatchObject({ appDir: '/builds/mine' })
  })

  it('says to build the editor when its build is not there, and starts nothing', async () => {
    const { deps, io, err, served } = setup({ exists: () => false })
    expect(await editorCommand(['--app', '2d'], io, deps)).toBe(2)
    expect(err.join('')).toContain('pnpm --filter @mcthaydt/automata-editor build')
    expect(served).toEqual([])
  })

  it('reports a server that will not start, exit 2', async () => {
    const { deps, io, err } = setup({
      serve: async () => {
        throw new Error('listen EADDRINUSE')
      },
    })
    expect(await editorCommand([], io, deps)).toBe(2)
    expect(err.join('')).toContain('listen EADDRINUSE')
  })

  it('prints the usage for --help, exit 0, and serves nothing', async () => {
    const { deps, io, out, served } = setup()
    expect(await editorCommand(['--help'], io, deps)).toBe(0)
    expect(out.join('')).toContain('Usage: automata editor')
    expect(served).toEqual([])
  })

  it('reports a bad option with the usage, exit 2', async () => {
    const { deps, io, err } = setup()
    expect(await editorCommand(['--app', 'vr'], io, deps)).toBe(2)
    expect(err.join('')).toContain('--app is 2d, 3d or suite')
    expect(err.join('')).toContain('automata editor')
  })
})

describe('liveEditorDeps', () => {
  it('finds each editor build where its package writes it', () => {
    const { builtApp } = liveEditorDeps()
    // From source there is no copy next to the bin, so the 2D editor is the repository's build.
    expect(builtApp('2d')).toMatch(/packages\/editor\/dist\/2d$/)
    expect(builtApp('3d')).toMatch(/packages\/editor-3d\/dist$/)
    // The suite is the 2D-only page; the full one, with the 3D editors, is served with --app-dir.
    expect(builtApp('suite')).toMatch(/packages\/editor\/dist\/suite$/)
  })

  it('knows it runs inside the repository from source', () => {
    expect(liveEditorDeps().inRepository).toBe(true)
  })
})
