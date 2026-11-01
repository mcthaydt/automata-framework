import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createHttpStore } from '@mcthaydt/automata-editor-kit/core'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type RunningEditor, serveEditor } from '../../../cli/src/editor/serve-editor.ts'
import { createTuner, type TunerSuiteSession } from '../editors/tuner/tuner-suite-editor'
import { servedPorts } from '../shell/served-ports'
import { createSuiteSession } from '../shell/suite-session'

// J3, the served half (the Owner's journey: open Emberwick in the suite, change its room and its tuning, save): the suite
// against a real `automata editor` server over a copy of the game's checkout, in the way the page reaches it, through
// the HTTP store. The server decides what may be read and written from the checkout's own `content/editors.toml`, and a
// save is the server's mtime-guarded write: what the test reads back is the file on disk. The game compiles `content/`,
// so a changed `content/tuning.toml` is what the game then shows; the room is the editor project the game's export is made
// from (the suite does not write that export yet, see the plan).

const GAME = join(import.meta.dirname, '../../../../games/emberwick')

let root: string
let running: RunningEditor | undefined
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'served-game-'))
  await cp(join(GAME, 'content'), join(root, 'content'), { recursive: true })
})
afterEach(async () => {
  await running?.close()
  running = undefined
  await rm(root, { recursive: true, force: true })
})

async function serve() {
  running = await serveEditor({ root, appDir: root, host: '127.0.0.1', port: 0 })
  const ports = await servedPorts(createHttpStore({ base: running.url }))
  return { ports, suite: createSuiteSession(ports) }
}

const onDisk = (path: string) => readFile(join(root, path), 'utf8')

describe('the suite on a served Emberwick checkout', () => {
  it('lists the checkout’s own rows: the room for Levels 2D and the tuning for the Tuner, both writable', async () => {
    const { ports } = await serve()
    expect((await ports.workspace.files('levels-2d')).map((f) => f.path)).toEqual([
      'content/rooms/room-1.af2d.json',
    ])
    expect((await ports.workspace.files('tuner')).map((f) => [f.path, f.writable])).toEqual([
      ['content/tuning.toml', true],
    ])
  })

  it('changes the tuning in the Tuner, writes the checkout, and Undo puts the file back', async () => {
    const { ports, suite } = await serve()
    const before = await onDisk('content/tuning.toml')
    const files = await ports.workspace.files('tuner')
    const tuner = createTuner() as SuiteEditor<TunerSuiteSession>
    const session = await tuner.open(files, suite.portsFor('tuner'))
    const read = session.controller.session.read()
    if ('problem' in read) throw new Error(read.problem)
    expect(read.tunables.find((each) => each.name === 'MAX_RUN')?.value).toBe(384)
    expect(await session.controller.session.set('MAX_RUN', 400)).toEqual({ ok: true })
    expect(await onDisk('content/tuning.toml')).toBe(
      before.replace('MAX_RUN = { value = 384,', 'MAX_RUN = { value = 400,'),
    )
    expect(await suite.undo('tuner')).toMatchObject({ written: true })
    expect(await onDisk('content/tuning.toml')).toBe(before)
  })

  it('changes the room in Levels 2D and writes the editor project in the checkout', async () => {
    const { ports, suite } = await serve()
    const before = await onDisk('content/rooms/room-1.af2d.json')
    const files = await ports.workspace.files('levels-2d')
    const levels = createLevels2d({ ids: { next: () => 'served-1' } }) as SuiteEditor<unknown>
    const session = (await levels.open(files, suite.portsFor('levels-2d'))) as {
      state: { kind: string; history: { apply(label: string, update: (state: object) => object): void } }
      settled(): Promise<void>
    }
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    session.state.history.apply('Rename', (project) => ({ ...project, name: 'Renamed in the suite' }))
    await session.settled()
    const after = await onDisk('content/rooms/room-1.af2d.json')
    expect(after).not.toBe(before)
    expect(after).toContain('Renamed in the suite')
    expect(await suite.undo('levels-2d')).toMatchObject({ written: true })
    expect(await onDisk('content/rooms/room-1.af2d.json')).toBe(before)
  })

  it('refuses the editor list itself and the compiler’s output', async () => {
    const { ports } = await serve()
    expect((await ports.workspace.write('content/editors.toml', 'x', { mtime: 0 })).ok).toBe(false)
    expect((await ports.workspace.write('content/generated/content.json', '{}', { mtime: 0 })).ok).toBe(false)
  })
})
