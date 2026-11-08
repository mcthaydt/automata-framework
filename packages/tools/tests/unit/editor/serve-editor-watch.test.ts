import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type RunningEditor, serveEditor } from '#src/features/editor/serve-editor.ts'

// `GET /api/watch`: a stream of the files that change under the checkout while the editor is open, so an editor
// follows a change made outside it (Claude Code on a branch, a `git pull` in the app). Real HTTP, a real folder.

const TOKEN = 'watch-token'
interface Change {
  readonly path: string
  readonly mtime: number | null
}
let root: string
let app: string
let running: RunningEditor | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'editor-watch-root-'))
  app = await mkdtemp(join(tmpdir(), 'editor-watch-app-'))
  await writeFile(join(app, 'index.html'), '<title>editor</title>')
  await mkdir(join(root, 'content/levels'), { recursive: true })
  await mkdir(join(root, 'node_modules/x'), { recursive: true })
  await writeFile(
    join(root, 'content/editors.toml'),
    [
      'format = "af-editors/1"',
      '',
      '[[file]]',
      'glob = "content/levels/*.af2d.json"',
      'editor = "levels-2d"',
      'modes = ["edit"]',
      'exports = "content"',
      'gates = []',
      'checks = ["content"]',
      '',
    ].join('\n'),
  )
  await writeFile(join(root, 'content/levels/depot.af2d.json'), '{"a":1}')
})

afterEach(async () => {
  await running?.close()
  running = undefined
  await rm(root, { recursive: true, force: true })
  await rm(app, { recursive: true, force: true })
})

const start = async (): Promise<RunningEditor> => {
  running = await serveEditor({
    root,
    appDir: app,
    host: '127.0.0.1',
    port: 0,
    token: TOKEN,
    watchDebounceMs: 20,
  })
  return running
}

/** Opens the stream the way the editor's store does: `fetch` with the token, reading the body as it arrives. */
async function openWatch(base: string): Promise<{ next(): Promise<Change>; stop(): void }> {
  const controller = new AbortController()
  const response = await fetch(`${base}/api/watch`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    signal: controller.signal,
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next() {
      for (;;) {
        const end = buffer.indexOf('\n\n')
        if (end >= 0) {
          const block = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          const data = block.split('\n').find((line) => line.startsWith('data: '))
          if (data !== undefined) return JSON.parse(data.slice('data: '.length)) as Change
          continue
        }
        const { value, done } = await reader.read()
        if (done) throw new Error('the stream ended')
        buffer += decoder.decode(value, { stream: true })
      }
    },
    stop: () => controller.abort(),
  }
}

describe('GET /api/watch', () => {
  it('gives one event for a write by another process, with the file and its new mtime', async () => {
    const { url } = await start()
    const watch = await openWatch(url)
    await writeFile(join(root, 'content/levels/depot.af2d.json'), '{"a":2}')
    const change = await watch.next()
    expect(change.path).toBe('content/levels/depot.af2d.json')
    expect(Number.isInteger(change.mtime)).toBe(true)
    watch.stop()
  })

  it('says a removed file has no mtime', async () => {
    const { url } = await start()
    const watch = await openWatch(url)
    await rm(join(root, 'content/levels/depot.af2d.json'))
    expect(await watch.next()).toEqual({ path: 'content/levels/depot.af2d.json', mtime: null })
    watch.stop()
  })

  it("stays quiet about the folders a tool owns: installs, git and the app's own", async () => {
    const { url } = await start()
    const watch = await openWatch(url)
    await writeFile(join(root, 'node_modules/x/index.js'), 'x')
    await mkdir(join(root, '.automata'), { recursive: true })
    await writeFile(join(root, '.automata/app.json'), '{}')
    await writeFile(join(root, 'content/levels/depot.af2d.json'), '{"a":3}')
    // The first event is the level file: nothing from the owned folders leaked through.
    expect((await watch.next()).path).toBe('content/levels/depot.af2d.json')
    watch.stop()
  })

  it('collapses a burst of writes into one event', async () => {
    const { url } = await start()
    const watch = await openWatch(url)
    for (const n of [1, 2, 3, 4]) await writeFile(join(root, 'content/levels/depot.af2d.json'), `{"a":${n}}`)
    await watch.next()
    await writeFile(join(root, 'content/levels/depot.af2d.json'), '{"a":9}')
    // The second event comes from the later write, so the burst made exactly one before it.
    expect((await watch.next()).path).toBe('content/levels/depot.af2d.json')
    watch.stop()
  })

  it('answers 401 without the token, like every route but the ping', async () => {
    const { url } = await start()
    expect((await fetch(`${url}/api/watch`)).status).toBe(401)
  })

  it('ends its streams when the server closes', async () => {
    const editor = await start()
    const watch = await openWatch(editor.url)
    await editor.close()
    running = undefined
    await expect(watch.next()).rejects.toThrow()
  })
})
