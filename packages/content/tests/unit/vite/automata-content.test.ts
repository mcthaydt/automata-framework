// The Vite plugin. The dev-server tests port FloorFifty's tests/content/watch.test.ts (122a220): the
// behavior worth pinning is recovery. A bad save reports, keeps the last good bytes and module, and leaves
// the watcher alive, so the fix is one more save rather than a restarted server.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { build, createLogger, createServer, type HotPayload, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type AutomataContentOptions, automataContent } from '#src/features/vite/automata-content.ts'
import { compileContent } from '#src/shared/compile/compile-content.ts'
import { defineContentSchema } from '#src/shared/schema/content-schema.ts'
import { copyFixture, fixtureOptions, simRoomsOptions } from '#src/testing/fixture-game.ts'

const servers: ViteDevServer[] = []

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close()
})

/** Polls until `predicate` holds, or gives up with a readable failure. */
async function waitFor(predicate: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const options = (root: string) => {
  const { root: _root, ...rest } = fixtureOptions(root)
  return rest
}

const editFile = (root: string, file: string, change: (text: string) => string): void => {
  const path = join(root, 'content', file)
  writeFileSync(path, change(readFileSync(path, 'utf8')))
}

const setGravity = (root: string, gravity: string): void =>
  editFile(root, 'tuning.toml', (text) => text.replace(/^GRAVITY = .*$/m, `GRAVITY = ${gravity}`))

interface CustomEvent {
  readonly event: string
  readonly data: { readonly hash?: string; readonly diagnostics?: readonly string[] }
}

/** A dev server on the fixture, with every custom HMR event it sends recorded. */
async function devServer(
  root: string,
  pluginOptions: AutomataContentOptions = options(root),
): Promise<{ server: ViteDevServer; events: CustomEvent[] }> {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [automataContent(pluginOptions)],
    server: { middlewareMode: true, hmr: false },
  })
  servers.push(server)
  const events: CustomEvent[] = []
  server.ws.send = ((payload: HotPayload) => {
    if (payload.type === 'custom') events.push(payload as unknown as CustomEvent)
  }) as typeof server.ws.send
  return { server, events }
}

const loadHash = async (server: ViteDevServer): Promise<string> =>
  ((await server.ssrLoadModule('virtual:automata/content')) as { contentHash: string }).contentHash

// 90 s budgets: real Vite builds and servers, slow on the shared af-linux runner under load. The root test:unit
// default is the same 90 s.
describe('vite build', () => {
  const buildApp = (root: string) => {
    writeFileSync(
      join(root, 'main.js'),
      "import { content, contentHash } from 'virtual:automata/content'\nconsole.log(contentHash, content.song['dusk-run'].bpm)\n",
    )
    return build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [automataContent(options(root))],
      build: { write: false, minify: false, rolldownOptions: { input: join(root, 'main.js') } },
    })
  }

  it('embeds the content and its hash', async () => {
    const root = copyFixture('valid')
    const { hash } = await Effect.runPromise(compileContent(fixtureOptions(root)))
    const output = await buildApp(root)
    const chunks = (Array.isArray(output) ? output : [output]).flatMap((result) =>
      'output' in result ? result.output : [],
    )
    const code = chunks.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
    expect(code).toContain(hash)
    expect(readFileSync(join(root, 'content/generated/content.hash'), 'utf8')).toBe(`${hash}\n`)
  }, 90_000)

  // Vite inlines an asset under `build.assetsInlineLimit` (4 kB by default) as a `data:` URL. Pixi's loader fetches
  // that URL and Ruken's CSP (`connect-src`) refuses it, so the asset never loads (DX.5a; the examples' #142).
  describe('a small asset', () => {
    const TINY_PNG_BYTES = 278 // the size of the sprite sheet that drew nothing in the examples (#142)

    const buildWithAsset = (root: string, buildOptions: Record<string, unknown> = {}) => {
      writeFileSync(join(root, 'tiny.png'), new Uint8Array(TINY_PNG_BYTES).fill(7))
      writeFileSync(
        join(root, 'main.js'),
        "import { contentHash } from 'virtual:automata/content'\nconsole.log(contentHash, new URL('./tiny.png', import.meta.url).href)\n",
      )
      return build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [automataContent(options(root))],
        build: {
          write: false,
          minify: false,
          rolldownOptions: { input: join(root, 'main.js') },
          ...buildOptions,
        },
      })
    }

    const outputOf = async (built: ReturnType<typeof build>) => {
      const results = await built
      return (Array.isArray(results) ? results : [results]).flatMap((result) =>
        'output' in result ? result.output : [],
      )
    }

    it('is emitted as a file, never inlined as a data: URL the CSP refuses to fetch', async () => {
      const output = await outputOf(buildWithAsset(copyFixture('valid')))
      const code = output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
      expect(code.includes('data:image/png'), 'the PNG was inlined as a data: URL').toBe(false)
      expect(output.filter((chunk) => chunk.fileName.endsWith('.png'))).toHaveLength(1)
    }, 90_000)

    it("keeps the game's own assetsInlineLimit", async () => {
      const output = await outputOf(buildWithAsset(copyFixture('valid'), { assetsInlineLimit: 4096 }))
      const code = output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
      expect(code.includes('data:image/png'), 'the PNG was emitted as a file').toBe(true)
    }, 90_000)
  })

  it('fails on a broken file, naming every diagnostic', async () => {
    const root = copyFixture('valid')
    editFile(root, 'songs/dusk-run.toml', (text) => `${text}tempoDrift = 3\n`)
    await expect(buildApp(root)).rejects.toThrow(
      'content/songs/dusk-run.toml:8:1  tempoDrift  unknownField: unknown field: tempoDrift',
    )
  }, 90_000)
})

describe('the sim content (M2.2)', () => {
  it('is exported beside the content, sharing its objects, with the sim hash', async () => {
    const root = copyFixture('sim-rooms')
    const { root: _root, ...rest } = simRoomsOptions(root)
    const { server } = await devServer(root, rest)
    const module = (await server.ssrLoadModule('virtual:automata/content')) as {
      content: Record<string, unknown>
      simContent: Record<string, unknown>
      simContentHash: string
    }
    expect(Object.keys(module.simContent).sort()).toEqual(['room', 'tuning'])
    // Built from `content`'s own properties, so the bundle holds the data once.
    expect(module.simContent.room).toBe(module.content.room)
    expect(module.simContent.tuning).toBe(module.content.tuning)
    expect(module.simContentHash).toBe(
      readFileSync(join(root, 'content/generated/sim-content.hash'), 'utf8').trim(),
    )
  }, 90_000)
})

describe('warnings', () => {
  it('logs a skipped file as a warning and still builds', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/songs/night-run.TOML'), 'title = "x"\n')
    writeFileSync(
      join(root, 'main.js'),
      "import { contentHash } from 'virtual:automata/content'\nconsole.log(contentHash)\n",
    )
    const warnings: string[] = []
    const logger = createLogger('silent')
    logger.warn = (message) => {
      warnings.push(message)
    }
    await build({
      root,
      configFile: false,
      customLogger: logger,
      plugins: [automataContent(options(root))],
      build: { write: false, rolldownOptions: { input: join(root, 'main.js') } },
    })
    expect(warnings).toContain(
      'content/songs/night-run.TOML:1:1  skippedFile: this file is not read; items are named like dusk-run.toml',
    )
  }, 90_000)
})

describe('vite dev', () => {
  it('publishes valid saves, keeps the last good content through a bad one, and recovers', async () => {
    const root = copyFixture('valid')
    const { server, events } = await devServer(root)
    const first = await loadHash(server)

    editFile(root, 'characters/cyan.toml', (text) => text.replace('"Cyan"', '"Cyan Two"'))
    await waitFor(() => events.length === 1, 'the first successful rebuild')
    const second = events[0]?.data.hash
    expect(events[0]?.event).toBe('automata:content')
    expect(second).not.toBe(first)
    expect(await loadHash(server)).toBe(second)
    const good = readFileSync(join(root, 'content/generated/content.json'), 'utf8')
    expect(good).toContain('Cyan Two')

    setGravity(root, '-5000.0')
    await waitFor(() => events.length === 2, 'the error event for the bad value')
    expect(events[1]).toEqual({
      type: 'custom',
      event: 'automata:content-error',
      data: {
        diagnostics: ['content/tuning.toml:20:1  GRAVITY  outOfRange: expected -1200..-100, received -5000'],
      },
    })
    expect(readFileSync(join(root, 'content/generated/content.json'), 'utf8')).toBe(good)
    expect(await loadHash(server)).toBe(second)

    setGravity(root, '-300.0')
    await waitFor(() => events.length === 3, 'recovery on the next valid save')
    expect(events[2]?.event).toBe('automata:content')
    expect(await loadHash(server)).toBe(events[2]?.data.hash)
  }, 90_000)

  it("watches content that lives outside Vite's root, as a journey's temp copy of a game does", async () => {
    // Vite watches its own root; a game served from its checkout with its content pointed at another folder
    // (AF_E2E_CONTENT_ROOT) must still see a save there.
    const content = copyFixture('valid')
    const server = await createServer({
      root: copyFixture('valid'),
      configFile: false,
      logLevel: 'silent',
      plugins: [automataContent(fixtureOptions(content))],
      server: { middlewareMode: true, hmr: false },
    })
    servers.push(server)
    const events: CustomEvent[] = []
    server.ws.send = ((payload: HotPayload) => {
      if (payload.type === 'custom') events.push(payload as unknown as CustomEvent)
    }) as typeof server.ws.send
    await loadHash(server)
    editFile(content, 'characters/cyan.toml', (text) => text.replace('"Cyan"', '"Cyan Two"'))
    await waitFor(() => events.length === 1, 'the rebuild for a save outside the root')
    expect(events[0]?.event).toBe('automata:content')
  }, 90_000)

  it('serves the module under a query too, so a page can import the new content after a save', async () => {
    // The browser keeps every module it imported, so a page that hears `automata:content` imports the module
    // again under a new URL (examples/2d/content/hot-reload). The query must not change what is served.
    const root = copyFixture('valid')
    const { server, events } = await devServer(root)
    editFile(root, 'characters/cyan.toml', (text) => text.replace('"Cyan"', '"Cyan Two"'))
    await waitFor(() => events.length === 1, 'the rebuild')
    const hash = events[0]?.data.hash ?? ''
    const fresh = (await server.ssrLoadModule(`virtual:automata/content?v=${hash}`)) as {
      contentHash: string
    }
    expect(fresh.contentHash).toBe(hash)
    // The browser asks for `/@id/__x00__virtual:automata/content?v=<hash>`; Vite's middleware unwraps it to this.
    const served = await server.transformRequest(`\0virtual:automata/content?v=${hash}`)
    expect(served?.code).toContain(hash)
  }, 90_000)

  it('sends a real HMR update for the content module, so a page that accepts it gets the new content in place', async () => {
    // The Tuner writes tuning.toml as you drag and the game beside it must change without reloading the page. A
    // custom event alone leaves the page holding the module it first imported; an HMR update goes up the importers
    // to the module that accepts it (the game's main.ts), which restarts the game on the new content.
    const root = copyFixture('valid')
    writeFileSync(
      join(root, 'main.js'),
      "import { contentHash } from 'virtual:automata/content'\nimport.meta.hot.accept('virtual:automata/content', () => {})\nconsole.log(contentHash)\n",
    )
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [automataContent(options(root))],
      server: { middlewareMode: true, ws: false },
    })
    servers.push(server)
    const sent: HotPayload[] = []
    const client = server.environments.client
    client.hot.send = ((payload: HotPayload) => {
      sent.push(payload)
    }) as typeof client.hot.send
    // The page's first load: main.js and, through its import, the content module enter the client's module graph.
    await client.transformRequest('/main.js')

    setGravity(root, '-300.0')
    await waitFor(() => sent.some((payload) => payload.type === 'update'), 'the HMR update')
    const update = sent.find((payload) => payload.type === 'update')
    // main.js is the boundary that accepts the content module: Vite re-imports the module there, no page reload.
    expect(
      update?.type === 'update' && update.updates.map(({ path, acceptedPath }) => [path, acceptedPath]),
    ).toEqual([['/main.js', '\0virtual:automata/content']])
    expect(sent.some((payload) => payload.type === 'full-reload')).toBe(false)
  }, 90_000)

  it("recovers after the game's code throws during a rebuild (audit of PR #8)", async () => {
    const root = copyFixture('valid')
    const mood = defineContentSchema(
      'mood',
      z.strictObject({
        name: z.string().transform((name) => {
          if (name === 'crash') throw new Error('kaboom')
          return name
        }),
      }),
      { file: 'mood.toml' },
    )
    writeFileSync(join(root, 'content/mood.toml'), 'name = "calm"\n')
    const { server, events } = await devServer(root, {
      ...options(root),
      schemas: [...options(root).schemas, mood],
    })
    const first = await loadHash(server)

    writeFileSync(join(root, 'content/mood.toml'), 'name = "crash"\n')
    await waitFor(() => events.length === 1, 'the error event for the throw')
    expect(events[0]).toEqual({
      type: 'custom',
      event: 'automata:content-error',
      data: {
        diagnostics: [
          'automata-content options: the schema for mood threw while reading content/mood.toml: kaboom',
        ],
      },
    })
    expect(await loadHash(server)).toBe(first)

    writeFileSync(join(root, 'content/mood.toml'), 'name = "tense"\n')
    await waitFor(() => events.length === 2, 'recovery on the next valid save')
    expect(events[1]?.event).toBe('automata:content')
    expect(await loadHash(server)).toBe(events[1]?.data.hash)
  }, 90_000)

  it('ignores a file that is not an authored source', async () => {
    const root = copyFixture('valid')
    const { server, events } = await devServer(root)
    await loadHash(server)
    writeFileSync(join(root, 'content/songs/note.toml.example'), "id = 'x'\n")
    writeFileSync(join(root, 'content/generated/scratch.toml'), 'x = 1\n')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(events).toEqual([])
  }, 90_000)
})
