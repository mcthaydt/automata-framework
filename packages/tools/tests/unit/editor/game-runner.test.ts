import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
})
