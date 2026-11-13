// A game's dev server, as `pnpm dev` runs it, on its own port, so a journey can see what the editor's Save did. The
// game's code runs from its checkout (where its packages are installed); `AF_E2E_CONTENT_ROOT` points its content at
// the journey's copy, the folder the editor saves into (the game's vite.config.ts reads it).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { stopProcess } from './run-editor.ts'

export interface RunningGame {
  readonly url: string
  readonly stop: () => Promise<void>
}

/** How much of the server's output is kept: the start of it, where the cause is. */
const SAID_CHARS = 4_000

export async function runGame(
  gameDir: string,
  contentRoot: string,
  port: number,
  /** More variables for the dev server, such as a journeys build's `VITE_AF_JOURNEYS`. */
  env: Readonly<Record<string, string>> = {},
): Promise<RunningGame> {
  // The game's own Vite, resolved from the game: the version it installs, not this package's.
  const vite = join(
    dirname(createRequire(join(gameDir, 'package.json')).resolve('vite/package.json')),
    'bin/vite.js',
  )
  const child = spawn(
    process.execPath,
    [vite, '--configLoader', 'runner', '--strictPort', '--host', 'localhost', '--port', String(port)],
    {
      cwd: gameDir,
      env: { ...process.env, ...env, AF_E2E_CONTENT_ROOT: contentRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  // What the server says, kept so that a server that stops or never answers fails the journey with its own words (Vite
  // prints the cause of a config that cannot load, such as a package it cannot find, before it exits).
  let said = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk: Buffer) => {
      said = (said + chunk.toString()).slice(0, SAID_CHARS)
    })
  const because = () => (said.trim() === '' ? '' : `:\n${said.trim()}`)
  const url = `http://localhost:${port}/`
  // Ready when the page answers; Vite prints its banner before it can serve, so the banner is not the signal.
  const deadline = Date.now() + 60_000
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`the game's dev server exited with ${child.exitCode}${because()}`)
    const answered = await fetch(url).then(
      (response) => response.ok,
      () => false,
    )
    if (answered) return { url, stop: () => stopProcess(child) }
    if (Date.now() > deadline) {
      await stopProcess(child)
      throw new Error(`the game's dev server did not answer on ${url} in 60 s${because()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}
