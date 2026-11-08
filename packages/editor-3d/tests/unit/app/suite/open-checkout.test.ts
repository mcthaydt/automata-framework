import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openSuite3d } from '#src/app/suite/open-suite-3d.ts'

// The full suite page opens the game it is served on, as the 2D page does: when its own origin answers `/api/ping` as an
// editor server, the files are the checkout's, over HTTP. Only served on its own (the site's try-it page) does it open a
// sample with a 3D room and Wick, kept in the browser (memory here, in Node).

const BASE_3D = new URL('../../../../../../games/base-3d/', import.meta.url).pathname
const LIST_PATH = 'content/editors.toml'

/** The files of base-3d that the suite lists, read from the real game. */
function base3d(): Record<string, string> {
  const files: Record<string, string> = { [LIST_PATH]: readFileSync(join(BASE_3D, LIST_PATH), 'utf8') }
  for (const [folder, suffix] of [
    ['content/levels', '.af-sector.json'],
    ['content/figures', '.toml'],
  ] as const)
    for (const name of readdirSync(join(BASE_3D, folder)))
      if (name.endsWith(suffix))
        files[`${folder}/${name}`] = readFileSync(join(BASE_3D, folder, name), 'utf8')
  return files
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A page whose origin is an editor server over a checkout holding `files`, or no server at all. */
function page(files: Record<string, string> | undefined) {
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (files === undefined) throw new TypeError('Failed to fetch')
    if (url.pathname === '/api/ping')
      return json({ automata: 'editor', token: false, game: 'Ember Hall', gameUrl: 'http://localhost:5173/' })
    if (url.pathname === '/api/list')
      return json(Object.keys(files).map((path) => ({ path, mtime: 1, size: files[path]?.length ?? 0 })))
    const text = files[url.searchParams.get('path') ?? '']
    return text === undefined ? json({ message: 'no such file' }, 404) : new Response(text)
  }) as typeof fetch
  return { origin: 'http://127.0.0.1:4173', search: '', fetch: fetchFn }
}

const paths = async (opened: Awaited<ReturnType<typeof openSuite3d>>, editor: string): Promise<string[]> =>
  (await opened.ports.workspace.files(editor)).map((file) => file.path)

describe('openSuite3d', () => {
  it("on a checkout the suite lists base-3d's room and Wick", async () => {
    const opened = await openSuite3d(page(base3d()))
    expect(opened.sample).toBe(false)
    expect(opened.game).toBe('Ember Hall')
    expect(opened.gameUrl).toBe('http://localhost:5173/')
    expect(await paths(opened, 'levels-3d')).toEqual(['content/levels/room.af-sector.json'])
    expect(await paths(opened, 'studio')).toEqual(['content/figures/wick.toml'])
  })

  it('served for the site it opens the sample with a 3D room and Wick', async () => {
    const opened = await openSuite3d(page(undefined))
    expect(opened.sample).toBe(true)
    expect(opened.game).toBeUndefined()
    expect((await paths(opened, 'levels-3d')).length).toBe(1)
    expect(await paths(opened, 'studio')).toContain('content/figures/wick.toml')
    // The sample's room opens in the editor: it reads and parses.
    const [room] = await paths(opened, 'levels-3d')
    expect(JSON.parse((await opened.ports.workspace.read(room as string))?.text ?? '').format).toMatch(
      /^af-sector\//,
    )
  })
})
