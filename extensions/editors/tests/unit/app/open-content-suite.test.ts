import { createFakeOpfs } from '@automata/editor/kit/testing'
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

  // The try-it page is the free web editor, so it holds back nothing: a visitor finds something to open in every editor
  // the page has, the 3D ones too.
  it.each([
    ['tuner', 'content/tuning.toml'],
    ['levels-3d', 'content/levels/hall.af-sector.json'],
    ['studio', 'content/figures/wick.toml'],
    ['feel', 'content/feel/feel.toml'],
    ['audio', 'content/audio/audio.toml'],
    ['writer', 'content/lines/shop.toml'],
    ['sequence', 'content/cutscenes/opening.toml'],
    ['schematic', 'content/nav/hall.toml'],
  ])('on its own opens the sample with a file for %s', async (editor, path) => {
    const opened = await openContentSuite(page(false))
    expect((await opened.ports.workspace.files(editor)).map((file) => file.path)).toContain(path)
  })

  it('on its own opens a sample that names both kinds of level editor, so the rail shows Levels 2D and Levels 3D', async () => {
    const opened = await openContentSuite(page(false))
    const bytes = await opened.ports.workspace.read('content/editors.toml')
    const list = bytes === undefined ? '' : bytes.text
    expect(list).toContain('editor = "levels-2d"')
    expect(list).toContain('editor = "levels-3d"')
  })

  // The sign-in thread found the page lost every edit on reload: the sample was kept in memory only.
  it('keeps the sample in the browser’s own storage: an edit is still there after a reload', async () => {
    const opfs = createFakeOpfs()
    const storage = { getDirectory: () => Promise.resolve(opfs) }
    const first = await openContentSuite({ ...page(false), storage })
    const lines = 'content/lines/shop.toml'
    const before = await first.ports.workspace.read(lines)
    expect(before).toBeDefined()
    const edited = `${before?.text}\n# edited by a visitor\n`
    expect(await first.ports.workspace.write(lines, edited, { mtime: before?.mtime ?? 0 })).toMatchObject({
      ok: true,
    })
    const level = 'content/levels/my-level.af2d.json'
    expect(await first.ports.workspace.write(level, '{}', 'absent')).toMatchObject({ ok: true })

    const again = await openContentSuite({ ...page(false), storage })
    expect(again.sample).toBe(true)
    expect((await again.ports.workspace.read(lines))?.text).toBe(edited)
    expect((await again.ports.workspace.files('levels-2d')).map((file) => file.path)).toEqual([level])
  })
})
