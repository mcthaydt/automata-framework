import { describe, expect, it } from 'vitest'
import { openContentSuite } from '#src/app/suite/open-content-suite.ts'

// The content editors' page opens the game it is served on, as the other suite pages do: when its own origin answers
// `/api/ping` as an editor server, the files are the checkout's, over HTTP, and Schematic can edit a real game's guard.
// Only served on its own (the site's try-it page) does it open the sample game held in memory.

const LIST = `format = "af-editors/1"

[[file]]
glob = "content/systems/*.toml"
editor = "schematic"
modes = ["edit"]
gates = []
checks = ["content"]
`
const files: Record<string, string> = {
  'content/editors.toml': LIST,
  'content/systems/yard.toml': 'scene = "yard"\n',
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A page whose origin is an editor server over a checkout holding `files`, or no server at all. */
function page(served: boolean) {
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (!served) throw new TypeError('Failed to fetch')
    if (url.pathname === '/api/ping')
      return json({ automata: 'editor', token: false, game: 'Yard', gameUrl: 'http://localhost:5173/' })
    if (url.pathname === '/api/list')
      return json(Object.keys(files).map((path) => ({ path, mtime: 1, size: files[path]?.length ?? 0 })))
    const text = files[url.searchParams.get('path') ?? '']
    return text === undefined ? json({ message: 'no such file' }, 404) : new Response(text)
  }) as typeof fetch
  return { origin: 'http://127.0.0.1:4173', search: '', fetch: fetchFn }
}

describe('openContentSuite', () => {
  it("on a checkout lists the game's own systems file for Schematic, not the sample's", async () => {
    const opened = await openContentSuite(page(true))
    expect(opened.sample).toBe(false)
    expect(opened.game).toBe('Yard')
    expect(opened.gameUrl).toBe('http://localhost:5173/')
    expect((await opened.ports.workspace.files('schematic')).map((file) => file.path)).toEqual([
      'content/systems/yard.toml',
    ])
  })

  it('on its own opens the sample, with the guard Schematic edits', async () => {
    const opened = await openContentSuite(page(false))
    expect(opened.sample).toBe(true)
    const paths = (await opened.ports.workspace.files('schematic')).map((file) => file.path)
    expect(paths).toContain('content/systems/hall.toml')
  })
})
