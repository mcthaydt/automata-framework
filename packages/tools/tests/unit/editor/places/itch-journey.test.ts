import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createItchPlace, liveItchDeps } from '#src/features/editor/places/itch-place.ts'
import { type RunningEditor, serveEditor } from '#src/features/editor/serve-editor.ts'

// The whole way a person goes, on the real server and the real itch.io place, with a stand-in `butler` program on
// PATH: make the zip, ask where to put it, answer with the page's address, and butler is run with the zip, the project
// and the channel. The key stays butler's: nothing of it reaches the game's folder or the answer.

const posix = process.platform !== 'win32'
let running: RunningEditor | undefined
const folders: string[] = []
afterEach(async () => {
  await running?.close()
  running = undefined
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true })
})

describe.skipIf(!posix)('Publish to itch.io, with a stand-in butler', () => {
  it('pushes the zip it made to the person’s page, and never writes the key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'journey-game-'))
    const app = await mkdtemp(join(tmpdir(), 'journey-app-'))
    const bin = await mkdtemp(join(tmpdir(), 'journey-bin-'))
    folders.push(root, app, bin)
    await writeFile(join(app, 'index.html'), '<title>editor</title>')
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'my-game', version: '0.3.0' }))
    await writeFile(
      join(root, 'ship.config.ts'),
      "export default {\n  itch: { project: 'x/y', channel: 'html5' },\n}\n",
    )
    const zip = join(root, 'my-game-0.3.0-itch.zip')
    await writeFile(zip, 'PK')
    const log = join(bin, 'butler.log')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'butler'), `#!/bin/sh\necho "$@" >> "${log}"\necho "Pushed" \n`)
    await chmod(join(bin, 'butler'), 0o755)
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, BUTLER_API_KEY: 'secret-key-123' }
    running = await serveEditor({
      root,
      appDir: app,
      publish: async () => ({ ok: true, file: zip }),
      places: [createItchPlace(liveItchDeps(env, 'linux'))],
    })
    const call = (path: string, body?: unknown) =>
      fetch(`${running?.url}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
    await call('/api/publish')
    const done = await call('/api/places/itch', { answers: { page: 'https://Your-Name.itch.io/My-Game/' } })
    const body = (await done.json()) as { ok: boolean; link?: string }
    expect(body).toEqual({ ok: true, link: 'https://your-name.itch.io/my-game' })
    const pushed = (await readFile(log, 'utf8')).trim()
    expect(pushed).toBe(`push ${zip} your-name/my-game:html5 --userversion 0.3.0 --if-changed`)
    // The page's address is kept in the game's config, so the next push and `automata ship publish` agree.
    expect(await readFile(join(root, 'ship.config.ts'), 'utf8')).toContain("project: 'your-name/my-game'")
    for (const name of await readdir(root))
      expect(await readFile(join(root, name), 'utf8')).not.toContain('secret-key-123')
    expect(JSON.stringify(body)).not.toContain('secret-key-123')
  })
})
