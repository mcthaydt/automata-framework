// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { SAMPLE_GAME } from '#src/features/suite/memory/sample-ports.ts'
import { openSuitePorts } from '#src/features/suite/shell/open-suite-ports.ts'

// The suite page opens the game it is served on: when its own origin answers `/api/ping` as an editor server, the
// files are the checkout's, over HTTP; only when nothing answers does it open the sample game held in memory.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const LIST = `format = "af-editors/1"
[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`

/** A page whose origin is an editor server over a checkout holding `files`, or no server at all. */
function page(files: Record<string, string> | undefined) {
  const asked: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    asked.push(url.pathname)
    if (files === undefined) throw new TypeError('Failed to fetch')
    if (url.pathname === '/api/ping')
      return json({ automata: 'editor', token: false, gameUrl: 'http://localhost:5173/' })
    if (url.pathname === '/api/list')
      return json(Object.keys(files).map((path) => ({ path, mtime: 1, size: files[path]?.length ?? 0 })))
    const text = files[url.searchParams.get('path') ?? '']
    return text === undefined ? json({ message: 'no such file' }, 404) : new Response(text)
  }) as typeof fetch
  return { asked, env: { origin: 'http://127.0.0.1:4173', search: '', fetch: fetchFn } }
}

describe('openSuitePorts', () => {
  it("opens the checkout over HTTP when the page is served by automata editor, and lists the list's files", async () => {
    const { asked, env } = page({ [EDITOR_LIST_PATH]: LIST, 'content/rooms/room-1.af2d.json': '{}' })
    const opened = await openSuitePorts(env)
    expect(opened.sample).toBe(false)
    expect((await opened.ports.workspace.files('levels-2d')).map((file) => file.path)).toEqual([
      'content/rooms/room-1.af2d.json',
    ])
    expect((await opened.ports.workspace.read(EDITOR_LIST_PATH))?.text).toBe(LIST)
    expect(opened.ports.changeSet).toBeUndefined()
    expect(asked[0]).toBe('/api/ping')
    // The Tuner shows the game's dev page beside its settings.
    expect(opened.gameUrl).toBe('http://localhost:5173/')
  })

  it('opens the sample game only when no editor server answers', async () => {
    const opened = await openSuitePorts(page(undefined).env)
    expect(opened.sample).toBe(true)
    expect(opened.gameUrl).toBeUndefined()
    expect((await opened.ports.workspace.read(EDITOR_LIST_PATH))?.text).toBe(SAMPLE_GAME[EDITOR_LIST_PATH])
  })
})
