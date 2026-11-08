import { openSuitePorts } from '@automata/editor/suite'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openTomlSession } from '#src/shared/toml-session.ts'

// A person takes Feel's row out of content/editors.toml by hand while Feel is open. The server re-reads the list, so it
// refuses Feel's file from then on; the page still has the list it opened with. What the person must hear is that Feel
// can't save, not a thrown 403, and the file must not change.

const PATH = 'content/feel/feel.toml'
const LIST = 'format = "af-editors/1"\n'
const FEEL_ROW = `[[file]]\nglob = "content/feel/*.toml"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
const schema = z.looseObject({})
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** What `automata editor` answers for a checkout whose list is `listed` now; the page opened when it listed Feel. */
function server() {
  const files: Record<string, string> = {
    'content/editors.toml': `${LIST}${FEEL_ROW}`,
    [PATH]: '# feel\n',
  }
  let feelListed = true
  const refusals: string[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.searchParams.get('path') ?? ''
    if (url.pathname === '/api/ping') return json({ automata: 'editor', token: false })
    if (url.pathname === '/api/list')
      return json(
        Object.keys(files)
          .filter((name) => feelListed || name !== PATH)
          .map((name) => ({ path: name, mtime: 1, size: files[name]?.length ?? 0 })),
      )
    if (path === PATH && !feelListed) {
      const write = init?.method === 'PUT' || init?.method === 'DELETE'
      refusals.push(path)
      return json({ message: `${path} is not one the editor may ${write ? 'write' : 'read'}` }, 403)
    }
    if (init?.method === 'PUT') {
      files[path] = new TextDecoder().decode(init.body as Uint8Array)
      return json({ mtime: 2 })
    }
    const text = files[path]
    return text === undefined ? json({ message: 'no such file' }, 404) : new Response(text)
  }) as typeof fetch
  return {
    files,
    refusals,
    env: { origin: 'http://127.0.0.1:4173', search: '', fetch: fetchFn },
    unlistFeel: () => {
      feelListed = false
    },
  }
}

describe('a served game whose list loses a row under an open editor', () => {
  it("says the editor can't save, leaves the file as it was, and throws nothing", async () => {
    const { files, env, unlistFeel, refusals } = server()
    const { ports } = await openSuitePorts(env)
    const toml = await openTomlSession({ path: PATH, ports, schema, empty: '', editor: 'feel' })
    unlistFeel()
    const outcome = await toml.accept('# feel\n# more\n', 'Edit')
    expect(refusals.length).toBeGreaterThan(0)
    expect(outcome).toEqual({
      ok: false,
      message: "Feel can't save: this game's list of editors leaves Feel out.",
    })
    expect(files[PATH]).toBe('# feel\n')
    // The refused step was taken back: what is shown is what the file holds.
    expect(toml.read()).toMatchObject({ kind: 'ok' })
    expect(toml.history.state.text).toBe('# feel\n')
  })
})
