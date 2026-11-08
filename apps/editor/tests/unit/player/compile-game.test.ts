import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { type CompiledGame, compileGame, type PlayRefusal } from '#src/features/player/compile-game.ts'
import { scanSpecifiers } from '#src/features/player/vite-subset.ts'
import { fakeRuntime, gameFromDisk, gameStore, newGame } from './fake-games.ts'

const emberwick = join(import.meta.dirname, '../../../../../games/emberwick')
const text = new TextDecoder()
const asText = (data: string | Uint8Array | undefined): string =>
  typeof data === 'string' ? data : data === undefined ? '' : text.decode(data)

/** The game, or fails the test with why the app refused it. */
async function played(
  store: Awaited<ReturnType<typeof gameStore>>,
  runtime = fakeRuntime(),
): Promise<CompiledGame> {
  const result = await compileGame(store, runtime)
  if ('reason' in result) throw new Error(`refused (${result.reason}): ${result.message}`)
  return result
}

async function refused(
  store: Awaited<ReturnType<typeof gameStore>>,
  runtime = fakeRuntime(),
): Promise<PlayRefusal> {
  const result = await compileGame(store, runtime)
  if (!('reason' in result)) throw new Error('expected the app to refuse this game')
  return result
}

const PAGE = (script = './main.ts') =>
  `<!doctype html><html><head><title>t</title></head><body><script type="module" src="${script}"></script></body></html>`
const MINI = {
  'package.json': JSON.stringify({ dependencies: { '@mcthaydt/automata': '^0.1.0' } }),
  'index.html': PAGE(),
}
const mini = (files: Record<string, string | Uint8Array>) => gameStore({ ...MINI, ...files })

/** Every relative import in the output names a file in the output, and every bare one is in the runtime. */
function expectWhole(game: CompiledGame, runtimeKeys: readonly string[]): void {
  for (const [path, data] of game.files) {
    if (!path.endsWith('.js')) continue
    for (const { value } of scanSpecifiers(asText(data))) {
      if (value.startsWith('.')) {
        const target = join('/', path, '..', value).slice(1)
        expect(game.files.has(target), `${path} imports ${value}`).toBe(true)
      } else expect(runtimeKeys, `${path} imports ${value}`).toContain(value)
    }
  }
}

describe('compileGame: the games the app is built for', () => {
  it('compiles Emberwick into a page, an import map and plain modules', async () => {
    const runtime = fakeRuntime()
    const game = await played(await gameFromDisk(emberwick), runtime)
    expect(game.entry).toBe('index.html')
    const page = asText(game.files.get('index.html'))
    expect(page).toContain('<script type="importmap">')
    expect(page).toContain('"pixi.js"')
    expect(page).toContain('<script type="module" src="./main.js"></script>')
    expect(page).toContain('href="./style.css"')
    expect(page).toContain('latin-400.css')
    expect([...game.files.keys()].filter((path) => path.endsWith('.ts'))).toEqual([])
    expect(game.files.has('src/app/game.js')).toBe(true)
    expect(asText(game.files.get('__automata__/content.js'))).toContain('export const contentHash')
    expect(asText(game.files.get('main.js'))).toContain('undefined?.accept')
    expectWhole(game, Object.keys(runtime.packages))
  })

  it('gives Emberwick the content hashes the computer’s compile wrote beside its content', async () => {
    const game = await played(await gameFromDisk(emberwick))
    const module = asText(game.files.get('__automata__/content.js'))
    const hash = (name: string) => readFileSync(join(emberwick, 'content/generated', name), 'utf8').trim()
    expect(module).toContain(`export const contentHash = ${JSON.stringify(hash('content.hash'))}`)
    expect(module).toContain(`export const simContentHash = ${JSON.stringify(hash('sim-content.hash'))}`)
  })

  it('compiles the 2D starter a phone makes', async () => {
    const runtime = fakeRuntime()
    const game = await played(await newGame(), runtime)
    expect([...game.files.keys()]).toContain('src/main.js')
    expect(asText(game.files.get('index.html'))).toContain('src="./src/main.js"')
    expectWhole(game, Object.keys(runtime.packages))
  })

  it('compiles the same game to the same files every time', async () => {
    const store = await newGame()
    const first = await played(store)
    const second = await played(store)
    expect([...second.files]).toEqual([...first.files])
  })

  it('changes nothing in the game’s folder', async () => {
    const store = await newGame()
    const before = await store.list('')
    await played(store)
    expect(await store.list('')).toEqual(before)
  })
})

describe('compileGame: what Vite did, done here', () => {
  it('turns a glob for urls into an object of urls and carries the pictures along', async () => {
    const game = await played(
      await mini({
        'main.ts':
          "export const art = import.meta.glob('./art/*.png', { eager: true, query: '?url', import: 'default' })\n",
        'art/a.png': new Uint8Array([1, 2]),
        'art/b.png': new Uint8Array([3]),
      }),
    )
    const code = asText(game.files.get('main.js'))
    expect(code).toContain('"./art/a.png": new URL("./art/a.png", import.meta.url).href')
    expect(code).toContain('"./art/b.png": new URL("./art/b.png", import.meta.url).href')
    expect(game.files.get('art/a.png')).toEqual(new Uint8Array([1, 2]))
  })

  it('takes a stylesheet import out of the script and links it from the page', async () => {
    const game = await played(
      await mini({
        'main.ts': "import './extra.css'\nimport '@mcthaydt/automata/theme.css'\nexport const x = 1\n",
        'extra.css': 'body { color: red }',
      }),
    )
    expect(asText(game.files.get('main.js'))).not.toContain('.css')
    const page = asText(game.files.get('index.html'))
    expect(page).toContain('<link rel="stylesheet" href="./extra.css">')
    expect(page).toContain('<link rel="stylesheet" href="./runtime/@mcthaydt_automata_theme.css">')
    expect(game.files.get('extra.css')).toBe('body { color: red }')
  })

  it('reads relative imports with or without an extension, and the package’s #src', async () => {
    const store = await mini({
      'package.json': JSON.stringify({
        dependencies: { '@mcthaydt/automata': '^0.1.0' },
        imports: { '#src/*': './src/*' },
      }),
      'main.ts':
        "import { a } from './a.ts'\nimport { b } from './sub'\nimport { c } from '#src/c.ts'\nconsole.log(a, b, c)\n",
      'a.ts': 'export const a: number = 1\n',
      'sub/index.ts': 'export const b = 2\n',
      'src/c.ts': 'export const c = 3\n',
    })
    const game = await played(store)
    expectWhole(game, Object.keys(fakeRuntime().packages))
    expect(asText(game.files.get('main.js'))).toContain("from './a.js'")
    expect(asText(game.files.get('main.js'))).toContain("from './sub/index.js'")
    expect(asText(game.files.get('main.js'))).toContain("from './src/c.js'")
    expect(asText(game.files.get('a.js'))).not.toContain(': number')
  })

  it('does not follow a type-only import, which leaves no code', async () => {
    const game = await played(
      await mini({ 'main.ts': "import type { Nope } from './nope.ts'\nexport const a = 1\n" }),
    )
    expect(game.files.has('main.js')).toBe(true)
  })
})

describe('compileGame: a game the app says no to', () => {
  it('names a package it cannot run', async () => {
    const refusal = await refused(
      await mini({ 'main.ts': "import * as THREE from 'three'\nconsole.log(THREE)\n" }),
    )
    expect(refusal).toEqual({
      reason: 'package',
      message: "This game uses three, which the phone app can't run. Play it on a computer.",
      file: 'main.ts',
    })
  })

  it('names a scoped package by its scope and name, not its subpath', async () => {
    const refusal = await refused(
      await mini({ 'main.ts': "import x from '@scope/thing/deep/file'\nconsole.log(x)\n" }),
    )
    expect(refusal.message).toBe(
      "This game uses @scope/thing, which the phone app can't run. Play it on a computer.",
    )
  })

  it('refuses a game made for a newer app, and plays one made for an older or the same', async () => {
    const needs = (spec: string) =>
      mini({
        'package.json': JSON.stringify({ dependencies: { '@mcthaydt/automata': spec } }),
        'main.ts': '',
      })
    expect(await refused(await needs('^0.2.0'))).toEqual({
      reason: 'newer',
      message: 'This game needs a newer app. Update Automata to play it.',
    })
    await played(await needs('^0.1.0'))
    await played(await needs('^0.0.9'))
    await played(await needs('workspace:*'))
  })

  it('refuses a Svelte file of the game’s own, naming it', async () => {
    const refusal = await refused(
      await mini({
        'main.ts': "import Panel from './panel.svelte'\nconsole.log(Panel)\n",
        'panel.svelte': '<p>x</p>',
      }),
    )
    expect(refusal).toEqual({
      reason: 'svelte',
      message: "panel.svelte is a Svelte file, which the phone app can't run yet. Play it on a computer.",
      file: 'panel.svelte',
    })
  })

  it('plays a game that has a Svelte file it never imports', async () => {
    await played(await mini({ 'main.ts': 'export {}\n', 'unused.svelte': '<p>x</p>' }))
  })

  it('refuses a build plugin other than Svelte and the content plugin', async () => {
    const refusal = await refused(
      await mini({
        'main.ts': 'export {}\n',
        'vite.config.ts': 'export default defineConfig({ plugins: [svelte(), glsl()] })\n',
      }),
    )
    expect(refusal).toEqual({
      reason: 'plugin',
      message: "vite.config.ts uses glsl, which the phone app can't run. Play it on a computer.",
      file: 'vite.config.ts',
    })
  })

  it('accepts a config that wraps the content plugin in a function of its own', async () => {
    await played(
      await mini({
        'main.ts': 'export {}\n',
        'vite.config.ts':
          'function contentPlugin() { return automataContent({}) }\nexport default defineConfig({ plugins: [svelte(), contentPlugin()] })\n',
      }),
    )
  })

  it('refuses translations, naming content.config.ts', async () => {
    const refusal = await refused(
      await mini({
        'main.ts': 'export {}\n',
        'src/content.config.ts':
          "export const contentConfig = { schemas: [], paraglide: { project: './x' } }\n",
      }),
    )
    expect(refusal.reason).toBe('paraglide')
    expect(refusal.file).toBe('src/content.config.ts')
    expect(refusal.message).toBe(
      "src/content.config.ts asks for translations, which the phone app can't build yet. Play it on a computer.",
    )
  })

  it('gives the lines the Problems panel would show when the content is wrong', async () => {
    const store = await newGame()
    await store.write('content/project.toml', 'title = =\n')
    const refusal = await refused(store)
    expect(refusal.reason).toBe('content')
    expect(refusal.message).toContain('content/project.toml')
  })

  it('refuses a glob it cannot run, and an import of a file that is not there', async () => {
    const glob = await refused(
      await mini({ 'main.ts': "export const m = import.meta.glob('./mods/*.ts')\n" }),
    )
    expect(glob.reason).toBe('unsupported')
    expect(glob.file).toBe('main.ts')
    const missing = await refused(await mini({ 'main.ts': "import './gone.ts'\n" }))
    expect(missing).toEqual({
      reason: 'missing',
      message: "main.ts imports ./gone.ts, which isn't in the game.",
      file: 'main.ts',
    })
  })

  it('says so when there is no page to play', async () => {
    const refusal = await refused(await gameStore({ 'main.ts': 'export {}\n' }))
    expect(refusal.reason).toBe('missing')
    expect(refusal.message).toBe("This game has no index.html, so there's nothing to open.")
  })
})
