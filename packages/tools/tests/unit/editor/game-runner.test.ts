import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startGame } from '#src/features/editor/game-runner.ts'

// `automata editor` starts the game as `pnpm dev` would, so Play works from one command. The game here is a folder
// whose installed "vite" is a few lines of Node that serve a page on the port they are given: a real process on a real
// port, without a real build.

let game: string

beforeEach(async () => {
  game = await mkdtemp(join(tmpdir(), 'af-game-runner-'))
  await writeFile(join(game, 'package.json'), '{"name":"my-game","type":"module"}')
})

afterEach(async () => {
  await rm(game, { recursive: true, force: true })
})

async function installFakeVite(script: string): Promise<void> {
  const folder = join(game, 'node_modules/vite')
  await mkdir(join(folder, 'bin'), { recursive: true })
  await writeFile(join(folder, 'package.json'), '{"name":"vite","version":"0.0.0"}')
  await writeFile(join(folder, 'bin/vite.js'), script)
}

const SERVES = `
import { createServer } from 'node:http'
const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1])
createServer((req, res) => res.end('<title>' + process.cwd() + ' ' + args.join(' ') + '</title>')).listen(port, 'localhost')
`

describe('startGame', () => {
  it('starts the game’s own Vite in its folder on a free port, and is ready once the page answers', async () => {
    await installFakeVite(SERVES)
    const running = await startGame(game)
    try {
      expect(running.url).toMatch(/^http:\/\/localhost:\d+\/$/)
      const page = await (await fetch(running.url)).text()
      expect(page).toContain(game)
      expect(page).toContain('--strictPort')
    } finally {
      await running.stop()
    }
    await expect(fetch(running.url)).rejects.toThrow()
  })

  it('says to install the game’s packages when it has no Vite', async () => {
    await expect(startGame(game)).rejects.toThrow(
      'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.',
    )
  })

  it('says the game stopped, with its last words, when it exits before it answers', async () => {
    await installFakeVite("console.error('vite.config.ts: something broke'); process.exit(1)")
    await expect(startGame(game)).rejects.toThrow(/Your game stopped before it started[\s\S]*something broke/)
  })

  it('says the cause in one line and what to do, not a stack, when the game’s config cannot load', async () => {
    // What Vite prints for a package it cannot find: the cause is the third line, and a long stack follows it.
    const stack = Array.from(
      { length: 40 },
      (_, i) => `    at fetchModule (file:///node_modules/vite/chunk.js:${i}:1)`,
    )
    await installFakeVite(
      `console.error(${JSON.stringify(
        [
          'failed to load config from /g/vite.config.ts',
          'error when starting dev server:',
          "Error: Cannot find module '@automata/audio-synth' imported from '/g/vite.config.ts'",
          ...stack,
        ].join('\n'),
      )}); process.exit(1)`,
    )
    const message = await startGame(game).then(
      () => '',
      (error: Error) => error.message,
    )
    expect(message).toBe(
      "Your game stopped before it started: Cannot find module '@automata/audio-synth' imported from '/g/vite.config.ts'.\n" +
        'Fix that in the game, then start the editor again.',
    )
  })

  describe('the step `pnpm dev` runs before Vite', () => {
    // A game's `fonts` script is `automata-content assets`: it writes what main.ts imports. `automata editor` runs the
    // same script by the same content package, so a game never opened with pnpm dev still has its page.
    async function installContent(script: string): Promise<void> {
      const folder = join(game, 'node_modules/@automata/content')
      await mkdir(folder, { recursive: true })
      await writeFile(
        join(folder, 'package.json'),
        JSON.stringify({ name: '@automata/content', bin: { 'automata-content': './cli.js' } }),
      )
      await writeFile(join(folder, 'cli.js'), script)
      await writeFile(
        join(game, 'package.json'),
        JSON.stringify({ name: 'my-game', type: 'module', scripts: { fonts: 'automata-content assets' } }),
      )
    }
    // Vite refuses to start unless the step has run, as a page whose import is missing does.
    const NEEDS_THE_STEP = `
import { existsSync } from 'node:fs'
if (!existsSync('content/generated/made.txt')) { console.error('Error: Failed to resolve import fonts.css'); process.exit(1) }
`

    it('is run first, by the content package the game installed, in the game’s folder', async () => {
      await installContent(
        "import { mkdirSync, writeFileSync } from 'node:fs'; console.log(process.argv.slice(2).join(' ')); mkdirSync('content/generated', { recursive: true }); writeFileSync('content/generated/made.txt', process.argv.slice(2).join(' '))",
      )
      await installFakeVite(`${NEEDS_THE_STEP}${SERVES}`)
      const running = await startGame(game)
      await running.stop()
      expect(await readFile(join(game, 'content/generated/made.txt'), 'utf8')).toBe('assets')
    })

    it('says what failed, and that the game stays off, when the step fails', async () => {
      await installContent(
        "console.error('Error: fonts.toml names a font that is not there'); process.exit(2)",
      )
      await installFakeVite(SERVES)
      await expect(startGame(game)).rejects.toThrow(
        'Your game’s fonts could not be made: fonts.toml names a font that is not there.\nFix that in the game, then start the editor again.',
      )
    })

    it('is skipped for a game with no such script (the 3D game)', async () => {
      await installFakeVite(SERVES)
      const running = await startGame(game)
      await running.stop()
    })
  })
})
