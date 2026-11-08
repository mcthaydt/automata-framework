// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { SAMPLE_GAME } from '#src/features/suite/memory/sample-ports.ts'
import { openSuitePorts } from '#src/features/suite/shell/open-suite-ports.ts'

// The suite page opens the game it is served on: when its own origin answers `/api/ping` as an editor server, the
// files are the checkout's, over HTTP; only when nothing answers does it open the sample game held in memory.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const WITH_CHECK = `format = "af-editors/1"
[[file]]
glob = "content/systems/*.toml"
editor = "schematic"
modes = ["edit"]
gates = []
checks = ["content"]

[[check]]
id = "fair-play"
run = ["node", "fair.mjs"]
when = "after"
joins = []
measure = true
`

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
function page(files: Record<string, string> | undefined, extra: Record<string, unknown> = {}) {
  const asked: string[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    asked.push(url.pathname)
    if (files === undefined) throw new TypeError('Failed to fetch')
    if (url.pathname === '/api/ping')
      return json({ automata: 'editor', token: false, gameUrl: 'http://localhost:5173/', ...extra })
    if (url.pathname === '/api/checks/run') {
      asked.push(`run ${String(init?.body)}`)
      return json({
        results: [
          {
            check: 'fair-play',
            status: 'pass',
            findings: [],
            measure: [{ id: 'm', label: 'a measure', value: 100, ok: true }],
            output: '',
          },
        ],
      })
    }
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

  it('declares the editor list’s checks and runs them on the server, only when the server says it has them', async () => {
    const files = { [EDITOR_LIST_PATH]: WITH_CHECK, 'content/systems/guard.toml': 'a = 1' }
    const served = page(files, { checks: true })
    const opened = await openSuitePorts(served.env)
    expect(opened.ports.checks.declared().map((check) => check.id)).toEqual(['fair-play'])
    const run = await opened.ports.checks.run({
      checks: ['fair-play'],
      candidates: [{ path: 'content/systems/guard.toml', text: 'a = 2' }],
    })
    const [result] = await run.result()
    expect(result).toMatchObject({ check: 'fair-play', status: 'pass', measure: [{ value: 100 }] })
    expect(served.asked.some((entry) => entry.startsWith('run ') && entry.includes('"a = 2"'))).toBe(true)

    // A server that does not run checks leaves them undeclared: Fair play says it is not available instead of failing.
    const quiet = await openSuitePorts(page(files).env)
    expect(quiet.ports.checks.declared()).toEqual([])
  })
})
