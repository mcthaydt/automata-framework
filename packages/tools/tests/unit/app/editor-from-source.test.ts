import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// `automata editor` from the repository's source: the command reads the editor list through the editor package, which
// plain Node must be able to load. A real process proves the whole path, and it needs no editor build: a folder with an
// `index.html` stands in for it.
const BIN = join(import.meta.dirname, '../../../src/app/bin.ts')
const GAME = resolve(import.meta.dirname, '../../../../../games/emberwick')
const made: string[] = []

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Starts the source bin and resolves with the address it prints. */
function start(appDir: string): Promise<{ url: string; stop: () => void }> {
  const child = spawn(process.execPath, [BIN, 'editor', GAME, '--app-dir', appDir, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((done, fail) => {
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      fail(new Error(`no address within 20 s:\n${output}`))
    }, 20_000)
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      const found = /This computer: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
      if (found?.[1] === undefined) return
      clearTimeout(timer)
      done({ url: found[1], stop: () => child.kill() })
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
    child.on('exit', (code) => {
      clearTimeout(timer)
      fail(new Error(`exited ${code} before printing an address:\n${output}`))
    })
  })
}

describe('automata editor, run from source by plain Node', () => {
  it('prints its address within 20 seconds and answers a ping', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'af-editor-app-'))
    made.push(appDir)
    writeFileSync(join(appDir, 'index.html'), '<!doctype html><title>editor</title>')
    const running = await start(appDir)
    try {
      const ping = await fetch(`${running.url}/api/ping`)
      expect(await ping.json()).toEqual({ automata: 'editor', token: false })
    } finally {
      running.stop()
    }
  }, 30_000)
})
