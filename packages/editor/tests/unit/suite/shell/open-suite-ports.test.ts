// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { SAMPLE_GAME } from '#src/features/suite/memory/sample-ports.ts'
import { openSuitePorts } from '#src/features/suite/shell/open-suite-ports.ts'
import { editorRows, ensureListed } from '#src/shared/editor-list/editor-rows.ts'
import { createFakeOpfs } from '#src/testing/kit/fake-fs.ts'

// The suite page opens the game it is served on: when its own origin answers `/api/ping` as an editor server, the
// files are the checkout's, over HTTP; only when nothing answers does it open the sample game, kept in this browser.

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

/** Like `page`, but the checkout can be written: `PUT` keeps the bytes, as `automata editor` does for a list that grows. */
function writablePage(files: Record<string, string>) {
  const mtimes = new Map<string, number>()
  let clock = 1
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.searchParams.get('path') ?? ''
    if (url.pathname === '/api/ping') return json({ automata: 'editor', token: false })
    if (url.pathname === '/api/list')
      return json(
        Object.keys(files).map((name) => ({
          path: name,
          mtime: mtimes.get(name) ?? 1,
          size: files[name]?.length ?? 0,
        })),
      )
    if (init?.method === 'PUT') {
      files[path] = new TextDecoder().decode(init.body as Uint8Array)
      clock += 1
      mtimes.set(path, clock)
      return json({ mtime: clock })
    }
    const text = files[path]
    return text === undefined ? json({ message: 'no such file' }, 404) : new Response(text)
  }) as typeof fetch
  return { files, env: { origin: 'http://127.0.0.1:4173', search: '', fetch: fetchFn } }
}

describe('openSuitePorts: a list that grows', () => {
  it("adds an editor's rows through the page's ports, then writes and lists the editor's file", async () => {
    const { files, env } = writablePage({ [EDITOR_LIST_PATH]: LIST })
    const { ports } = await openSuitePorts(env)
    expect(await ensureListed(ports.workspace, 'feel')).toMatchObject({ ok: true })
    expect(files[EDITOR_LIST_PATH]).toContain(editorRows('feel'))
    // The next write is classed by the list as it is now, not as it was when the page opened.
    expect(await ports.workspace.write('content/feel/feel.toml', '# feel\n', 'absent')).toMatchObject({
      ok: true,
    })
    expect((await ports.workspace.files('feel')).map((file) => file.path)).toEqual(['content/feel/feel.toml'])
  })

  it('refuses a write of the list that adds anything but an editor’s own rows', async () => {
    const { files, env } = writablePage({ [EDITOR_LIST_PATH]: LIST })
    const { ports } = await openSuitePorts(env)
    const wider = `${LIST}\n[[file]]\nglob = "src/**"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
    const read = await ports.workspace.read(EDITOR_LIST_PATH)
    const result = await ports.workspace.write(EDITOR_LIST_PATH, wider, { mtime: read?.mtime ?? 0 })
    expect(result).toMatchObject({
      ok: false,
      reason: 'policy',
      message: "The editors can only add to this game's list of editors.",
    })
    expect(files[EDITOR_LIST_PATH]).toBe(LIST)
  })

  it('keeps a sample game’s grown list through a reload', async () => {
    const opfs = createFakeOpfs()
    const storage = { getDirectory: () => Promise.resolve(opfs) }
    const first = await openSuitePorts({ ...page(undefined).env, storage })
    expect(await ensureListed(first.ports.workspace, 'feel')).toMatchObject({ ok: true })
    expect(await first.ports.workspace.write('content/feel/feel.toml', '# feel\n', 'absent')).toMatchObject({
      ok: true,
    })
    const again = await openSuitePorts({ ...page(undefined).env, storage })
    expect((await again.ports.workspace.files('feel')).map((file) => file.path)).toEqual([
      'content/feel/feel.toml',
    ])
  })
})

describe('openSuitePorts', () => {
  it("opens the checkout over HTTP when the page is served by automata editor, and lists the list's files", async () => {
    const { asked, env } = page({ [EDITOR_LIST_PATH]: LIST, 'content/rooms/room-1.af2d.json': '{}' })
    const opened = await openSuitePorts(env)
    expect(opened.sample).toBe(false)
    expect((await opened.ports.workspace.files('levels-2d')).map((file) => file.path)).toEqual([
      'content/rooms/room-1.af2d.json',
    ])
    expect((await opened.ports.workspace.read(EDITOR_LIST_PATH))?.text).toBe(LIST)
    expect(asked[0]).toBe('/api/ping')
    // The Tuner shows the game's dev page beside its settings.
    expect(opened.gameUrl).toBe('http://localhost:5173/')
  })

  it("reads the content build's outputs through generated(), which a served page names", async () => {
    const { env } = page({
      [EDITOR_LIST_PATH]: LIST,
      'content/generated/events.json': '["player.jumped"]',
      'content/other.txt': 'x',
    })
    const { ports } = await openSuitePorts(env)
    expect(await ports.workspace.generated('content/generated/events.json')).toBe('["player.jumped"]')
    expect(await ports.workspace.generated('content/other.txt')).toBeUndefined()
  })

  it('keeps the sample game in the browser’s own storage, so a level made there is there after a reload', async () => {
    const opfs = createFakeOpfs()
    const storage = { getDirectory: () => Promise.resolve(opfs) }
    const first = await openSuitePorts({ ...page(undefined).env, storage })
    const level = 'content/levels/my-level.af2d.json'
    expect(await first.ports.workspace.write(level, '{}', 'absent')).toMatchObject({ ok: true })
    const tuning = await first.ports.workspace.read('content/tuning.toml')
    await first.ports.workspace.write('content/tuning.toml', '[player]\nspeed = 7\n', {
      mtime: tuning?.mtime ?? 0,
    })

    const again = await openSuitePorts({ ...page(undefined).env, storage })
    expect(again.sample).toBe(true)
    expect((await again.ports.workspace.files('levels-2d')).map((file) => file.path)).toEqual([level])
    // The visitor's own changes stay; the editor list is always the sample's.
    expect((await again.ports.workspace.read('content/tuning.toml'))?.text).toContain('speed = 7')
    expect((await again.ports.workspace.read(EDITOR_LIST_PATH))?.text).toBe(SAMPLE_GAME[EDITOR_LIST_PATH])
  })

  it('says whether the sample is kept: yes with private storage, no when the browser has none, and a checkout always', async () => {
    const opfs = createFakeOpfs()
    expect(
      (
        await openSuitePorts({
          ...page(undefined).env,
          storage: { getDirectory: () => Promise.resolve(opfs) },
        })
      ).kept,
    ).toBe(true)
    expect((await openSuitePorts({ ...page(undefined).env, storage: {} })).kept).toBe(false)
    expect((await openSuitePorts(page({ [EDITOR_LIST_PATH]: LIST }).env)).kept).toBe(true)
  })

  it('opens the sample game only when no editor server answers', async () => {
    const opened = await openSuitePorts(page(undefined).env)
    expect(opened.sample).toBe(true)
    expect(opened.gameUrl).toBeUndefined()
    expect((await opened.ports.workspace.read(EDITOR_LIST_PATH))?.text).toBe(SAMPLE_GAME[EDITOR_LIST_PATH])
  })
})
