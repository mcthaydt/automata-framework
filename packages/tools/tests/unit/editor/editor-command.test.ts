import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { type EditorCommandDeps, editorCommand, liveEditorDeps } from '#src/features/editor/editor-command.ts'
import type { EditorServerOptions } from '#src/features/editor/serve-editor.ts'

// `automata editor` (plan task 15.2): what it says, which page it serves (the game's editor list picks), and when it will not start. The server itself
// is `serve-editor.test.ts`'s; here it is a stand-in that records what it was asked to serve.

/** A valid editor list with one row for `editor`. */
const listOf = (editor: string): string =>
  `format = "af-editors/1"\n[[file]]\nglob = "content/x/*.toml"\neditor = "${editor}"\nmodes = ["edit"]\ngates = []\nchecks = []\n`

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
    builtApp: (page) => `/repo/builds/${page}`,
    readEditorList: () => undefined,
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
  it('serves the 2D page against the working folder on the loopback and says where', async () => {
    const { deps, io, out, served, closed } = setup()
    expect(await editorCommand([], io, deps)).toBe(0)
    expect(served[0]).toMatchObject({
      root: '/work',
      appDir: '/repo/builds/suite-2d',
      host: '127.0.0.1',
      token: undefined,
    })
    expect(out.join('')).toContain('http://127.0.0.1:5000')
    expect(closed).toHaveBeenCalled()
  })

  it('names the game by its title on the first line, whichever editor opens', async () => {
    const { deps, io, out } = setup({ cwd: '/home/ada/my-game' })
    await editorCommand([], io, deps)
    expect(out[0]).toMatch(/^Opened My game\.\n {2}This computer: http/)
    const suite = setup()
    await editorCommand(['../emberwick'], suite.io, suite.deps)
    expect(suite.out[0]).toMatch(/^Opened Emberwick\.\n/)
  })

  it('names a game by the title in its package.json, as the editor shows it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-editor-title-'))
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'base-3d', automata: { title: 'Ember Hall' } }),
      )
      const { deps, io, out } = setup()
      await editorCommand([dir], io, deps)
      expect(out[0]).toMatch(/^Opened Ember Hall\.\n/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('serves the full page when the game’s editor list names a 3D editor, and the 2D page otherwise', async () => {
    const full = setup({ readEditorList: () => listOf('levels-3d') })
    await editorCommand(['../game'], full.io, full.deps)
    expect(full.served[0]).toMatchObject({ root: '/game', appDir: '/repo/builds/suite-full' })
    const plain = setup()
    await editorCommand(['../game'], plain.io, plain.deps)
    expect(plain.served[0]).toMatchObject({ root: '/game', appDir: '/repo/builds/suite-2d' })
  })

  it('reads the list from the game’s own folder', async () => {
    const asked: string[] = []
    const { deps, io } = setup({
      readEditorList: (root) => {
        asked.push(root)
        return undefined
      },
    })
    await editorCommand(['../game'], io, deps)
    expect(asked).toEqual(['/game'])
  })

  it('says --app is gone, and starts nothing', async () => {
    const { deps, io, err, served } = setup()
    expect(await editorCommand(['--app', 'suite'], io, deps)).toBe(1)
    expect(err.join('')).toContain('This option is gone: automata editor picks the editors your game needs.')
    expect(served).toEqual([])
  })

  it("passes the game's dev page on to the server: Vite's own port unless told", async () => {
    const { deps, io, served } = setup()
    await editorCommand([], io, deps)
    await editorCommand(['--game-url', 'http://localhost:5180'], io, deps)
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

  it('says the 3D editors are not in this release when a game needs them outside the repository, and starts nothing', async () => {
    const { deps, io, err, served } = setup({
      inRepository: false,
      exists: () => false,
      readEditorList: () => listOf('studio'),
    })
    expect(await editorCommand([], io, deps)).toBe(2)
    expect(err.join('')).toContain('The 3D editors are not in this release yet.')
    expect(served).toEqual([])
  })

  it('opens the 2D page from the tools’ own copy outside the repository: that is where a stranger finds the Tuner', async () => {
    const { deps, io, served } = setup({ inRepository: false })
    expect(await editorCommand([], io, deps)).toBe(0)
    expect(served).toHaveLength(1)
  })

  it('serves a build given with --app-dir even outside the repository', async () => {
    const { deps, io, served } = setup({
      inRepository: false,
      readEditorList: () => listOf('levels-3d'),
    })
    expect(await editorCommand(['--app-dir', '/builds/mine'], io, deps)).toBe(0)
    expect(served[0]).toMatchObject({ appDir: '/builds/mine' })
  })

  it('says to build the editor when its build is not there, and starts nothing', async () => {
    const { deps, io, err, served } = setup({ exists: () => false })
    expect(await editorCommand([], io, deps)).toBe(2)
    expect(err.join('')).toContain('pnpm --filter @automata/editor build')
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
    expect(await editorCommand(['--wat'], io, deps)).toBe(2)
    expect(err.join('')).toContain('unknown option --wat')
    expect(err.join('')).toContain('automata editor')
  })
})

describe('liveEditorDeps', () => {
  it('finds each page where its package writes it', () => {
    const { builtApp } = liveEditorDeps()
    // From source there is no copy next to the bin, so the 2D page is the repository's build.
    expect(builtApp('suite-2d')).toMatch(/packages\/editor\/dist\/suite$/)
    expect(builtApp('suite-full')).toMatch(/packages\/editor-3d\/dist\/suite$/)
  })

  it('knows it runs inside the repository from source', () => {
    expect(liveEditorDeps().inRepository).toBe(true)
  })

  it('reads a game’s editor list from its folder, or nothing when it has none', () => {
    const { readEditorList } = liveEditorDeps()
    expect(
      readEditorList(fileURLToPath(new URL('../../../../../games/emberwick', import.meta.url))),
    ).toContain('levels-2d')
    expect(readEditorList('/no/such/game')).toBeUndefined()
  })
})
