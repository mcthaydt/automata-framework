import { EDITOR_LIST_PATH, ensureListed } from '@automata/editor/editor-list'
import type { SuitePorts } from '@automata/editor/kit/ports'
import { samplePorts } from '@automata/editor/suite'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ContentSession } from '#src/shared/content-session.svelte.ts'
import { openTomlSession } from '#src/shared/toml-session.ts'

// Starting a file is where an editor gets added to the game: the file is written only once its rows are in the game's
// list of editors, and a game whose list will not take them says so in words a person can act on.

const PATH = 'content/feel/feel.toml'
const schema = z.looseObject({})
const LIST = `format = "af-editors/1"
[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`

/** A game whose list leaves Feel out, with the suite's own `list.ensure` on its ports (or none, as an older host has). */
async function game(options: { files?: Record<string, string>; withList?: boolean } = {}) {
  const base = await samplePorts({ [EDITOR_LIST_PATH]: LIST, ...options.files })
  const ports: SuitePorts =
    options.withList === false
      ? base
      : { ...base, list: { ensure: (id) => ensureListed(base.workspace, id) } }
  return ports
}

async function feel(ports: SuitePorts) {
  const toml = await openTomlSession({
    path: PATH,
    ports,
    schema,
    empty: '# What the player feels.\n',
    editor: 'feel',
  })
  return new ContentSession(toml, undefined, 'Start the feel file')
}

describe('starting a file', () => {
  it("adds the editor's rows to the game's list once, then writes the file, and lists it", async () => {
    const ports = await game()
    const session = await feel(ports)
    expect(await session.start()).toEqual({ ok: true })
    const list = (await ports.workspace.read(EDITOR_LIST_PATH))?.text ?? ''
    expect(list.match(/content\/feel\/\*\.toml/g)).toHaveLength(1)
    expect((await ports.workspace.read(PATH))?.text).toBe('# What the player feels.\n')
    expect((await ports.workspace.files('feel')).map((file) => file.path)).toEqual([PATH])
  })

  it('takes Undo back to no file and leaves the editor listed', async () => {
    const ports = await game()
    const session = await feel(ports)
    await session.start()
    expect(await session.toml.undo()).toEqual({ ok: true })
    expect(await ports.workspace.read(PATH)).toBeUndefined()
    expect((await ports.workspace.read(EDITOR_LIST_PATH))?.text).toContain('content/feel/*.toml')
  })

  it('does not touch the list when the editor is listed already', async () => {
    const listed = `${LIST}\n[[file]]\nglob = "content/feel/*.toml"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
    const ports = await game({ files: { [EDITOR_LIST_PATH]: listed } })
    const before = await ports.workspace.read(EDITOR_LIST_PATH)
    expect(await (await feel(ports)).start()).toEqual({ ok: true })
    expect((await ports.workspace.read(EDITOR_LIST_PATH))?.mtime).toBe(before?.mtime)
  })

  it('says the list leaves the editor out, and how to fix it, when the ports cannot add it', async () => {
    const session = await feel(await game({ withList: false }))
    expect(await session.start()).toEqual({
      ok: false,
      message: "This game's list of editors doesn't include Feel yet. Press Start to add it.",
    })
    expect(session.message).toContain('Press Start to add it.')
  })

  it("says the editor can't save when a listed file loses its row", async () => {
    const ports = await game({ files: { [PATH]: '# feel\n' } })
    const toml = await openTomlSession({ path: PATH, ports, schema, empty: '', editor: 'feel' })
    expect(await toml.accept('# feel\n# more\n', 'Edit')).toEqual({
      ok: false,
      message: "Feel can't save: this game's list of editors leaves Feel out.",
    })
  })

  it("stops with the list's own words when the list cannot be added to", async () => {
    const ports = await game({ files: { [EDITOR_LIST_PATH]: 'format = "af-editors/1"\n[[file\n' } })
    const session = await feel(ports)
    const outcome = await session.start()
    expect(outcome.ok).toBe(false)
    expect(await ports.workspace.read(PATH)).toBeUndefined()
  })
})
