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
  const started: string[] = []
  const reach: boolean[] = []
  const stopped = vi.fn()
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
    startGame: async (root, options) => {
      started.push(root)
      reach.push(options.lan === true)
      return { url: 'http://localhost:5199/', stop: async () => stopped() }
    },
    publishGame: async () => ({ ok: true, file: '/work/my-game-0.1.0-itch.zip' }),
    cwd: '/work',
    ...overrides,
  }
  const io = { stdout: (text: string) => out.push(text), stderr: (text: string) => err.push(text) }
  return { deps, io, out, err, served, closed, started, stopped, reach }
}

/** What the command printed once the editor was open (the line it opens with is the game's name). */
const opened = (out: readonly string[]): string | undefined => out.find((text) => text.startsWith('Opened'))

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

  it('names the game by its title once it is open, whichever editor opens', async () => {
    const { deps, io, out } = setup({ cwd: '/home/ada/my-game' })
    await editorCommand([], io, deps)
    expect(opened(out)).toMatch(/^Opened My game\.\n {2}This computer: http/)
    const suite = setup()
    await editorCommand(['../emberwick'], suite.io, suite.deps)
    expect(opened(suite.out)).toMatch(/^Opened Emberwick\.\n/)
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
      expect(opened(out)).toMatch(/^Opened Ember Hall\.\n/)
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

  it('starts the game itself, hands its page to the server for Play and the Tuner, says where it is, and stops it at the end', async () => {
    const { deps, io, out, served, started, stopped } = setup()
    expect(await editorCommand(['../my-game'], io, deps)).toBe(0)
    expect(started).toEqual(['/my-game'])
    expect(served[0]?.gameUrl).toBe('http://localhost:5199/')
    expect(out.join('')).toContain('Your game is running: http://localhost:5199/')
    expect(stopped).toHaveBeenCalled()
  })

  it('with --lan, starts the game where a tablet can reach it too', async () => {
    const { deps, io, reach } = setup()
    await editorCommand([], io, deps)
    await editorCommand(['--lan'], io, deps)
    expect(reach).toEqual([false, true])
  })

  it('uses the game page it was given and starts no game of its own', async () => {
    const { deps, io, served, started } = setup()
    await editorCommand(['--game-url', 'http://localhost:5180'], io, deps)
    expect(started).toEqual([])
    expect(served[0]?.gameUrl).toBe('http://localhost:5180/')
  })

  it('says in plain words when the game cannot start, and still opens the editor without Play', async () => {
    const { deps, io, out, served } = setup({
      startGame: async () => {
        throw new Error('Your game’s packages are not installed. Run pnpm install in its folder.')
      },
    })
    expect(await editorCommand([], io, deps)).toBe(0)
    expect(served[0]?.gameUrl).toBeUndefined()
    expect(out.join('')).toContain('Play is off: Your game’s packages are not installed.')
  })

  it('tells the editor why Play is off, so the page can say it too', async () => {
    const { deps, io, served } = setup({
      startGame: async () => {
        throw new Error('Your game’s packages are not installed. Run pnpm install in its folder.')
      },
    })
    await editorCommand([], io, deps)
    expect(served[0]?.playOff).toBe('Your game’s packages are not installed. Run pnpm install in its folder.')
    const fine = setup()
    await editorCommand([], fine.io, fine.deps)
    expect(fine.served[0]?.playOff).toBeUndefined()
  })

  it('says it is starting the game before it waits for it, so a slow start does not look like a hang', async () => {
    const { deps, io, out } = setup({
      startGame: async () => {
        expect(out.join('')).toContain('Starting your game…')
        return { url: 'http://localhost:5199/', stop: async () => {} }
      },
    })
    await editorCommand([], io, deps)
    expect(out[0]).toBe('Starting your game…\n')
  })

  it('starts no game and says nothing of one when it was given a game address', async () => {
    const { deps, io, out } = setup()
    await editorCommand(['--game-url', 'http://localhost:5180'], io, deps)
    expect(out.join('')).not.toContain('Starting your game')
  })

  it('with --lan, warns that the game itself has no token, and says so in nothing else', async () => {
    const lan = setup()
    await editorCommand(['--lan'], lan.io, lan.deps)
    expect(lan.out.join('')).toContain(
      'Anyone on your network can open your game and see its files, with no token. Use --lan only on a network you trust.',
    )
    const local = setup()
    await editorCommand([], local.io, local.deps)
    expect(local.out.join('')).not.toContain('Anyone on your network')
  })

  it('hands the server the way to publish the game it opened', async () => {
    const published: string[] = []
    const { deps, io, served } = setup({
      publishGame: async (root) => {
        published.push(root)
        return { ok: true, file: `${root}/my-game-0.1.0-itch.zip` }
      },
    })
    await editorCommand(['../my-game'], io, deps)
    expect(await served[0]?.publish?.()).toEqual({ ok: true, file: '/my-game/my-game-0.1.0-itch.zip' })
    expect(published).toEqual(['/my-game'])
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

  it('says the editors are missing from a copy of the tools without the 2D page, and starts nothing', async () => {
    const { deps, io, err, served } = setup({ inRepository: false, exists: () => false })
    expect(await editorCommand([], io, deps)).toBe(2)
    expect(err.join('')).toContain(
      'The editors are missing from this copy of the tools. Install them again: pnpm add -D @automata/tools',
    )
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
