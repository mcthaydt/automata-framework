import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor, SuitePorts, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '../core'
import { createStudio } from '../editors/studio/studio-suite-editor'
import { createTuner } from '../editors/tuner/tuner-suite-editor'
import { createSuiteSession } from '../shell/suite-session'
import { samplePorts } from '../testing/sample-ports'

// EDS.11, the headless half (editor suite spec §8, §13 EDS-y; plan EDS.10/11 step 6): the suite opens and edits the two
// 1.0 games' real content, Emberwick (2D) and base-3d (3D), with the same editors and no game named in them. Each editor
// the game's list gives work to opens its row group through the suite's write path, makes one edit, and the file differs
// from the original only where that edit is; the suite's Undo puts it back byte for byte. The checks are the memory
// ports' (no live `content` compile in this gate: the games' own tests run it). The browser journeys are the editors'; a
// person's iPad pass stays the Owner's.

const REPO = join(import.meta.dirname, '../../../..')

/** A game's files as the suite sees them: workspace paths (`content/...`) to text, from a folder of the checkout. */
function gameFiles(root: string, skip: readonly string[]): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const shown = relative(root, path)
      if (skip.some((prefix) => shown.startsWith(prefix))) continue
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(toml|json)$/.test(name)) files[shown] = readFileSync(path, 'utf8')
    }
  }
  walk(join(root, 'content'))
  return files
}

/** The span a change touched: what is left after the shared start and end are taken off. */
function changedSpan(before: string, after: string): { removed: string; added: string } {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1
  let end = 0
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end += 1
  return { removed: before.slice(start, before.length - end), added: after.slice(start, after.length - end) }
}

interface Probe {
  readonly editor: SuiteEditor<unknown>
  /** Makes one edit through the opened session and returns the file it wrote. */
  edit(session: unknown): Promise<string>
  /** The edit's span must be at most this long (a value, not a reprint). */
  readonly span: number
}

const tuner: Probe = {
  editor: createTuner() as SuiteEditor<unknown>,
  span: 12,
  async edit(session) {
    const tuning = (session as import('../editors/tuner/tuner-suite-editor').TunerSuiteSession).controller
      .session
    const read = tuning.read()
    if ('problem' in read) throw new Error(read.problem)
    const target = read.tunables.find((each) => each.editable && typeof each.value === 'number')
    if (target === undefined || typeof target.value !== 'number') throw new Error('no editable number')
    const step = target.step ?? 1
    const up = target.value + step
    const value = target.max !== undefined && up > target.max ? target.value - step : up
    const outcome = await tuning.set(target.name, value)
    if (!outcome.ok) throw new Error(outcome.message)
    return 'content/tuning.toml'
  },
}

const levels2d: Probe = {
  editor: createLevels2d({ ids: { next: () => 'accept-1' } }) as SuiteEditor<unknown>,
  span: 40,
  async edit(session) {
    const level = session as import('@mcthaydt/automata-editor-2d/suite').Levels2dSession
    if (level.state.kind !== 'open') throw new Error(level.state.kind)
    level.state.history.apply('Rename', (project) => ({
      ...(project as object),
      name: 'Renamed in the suite',
    }))
    await level.settled()
    return level.path
  },
}

const levels3d: Probe = {
  editor: createLevels3d({
    now: () => 0,
    renderer: async () => undefined as never,
    schedule: () => () => {},
  }) as SuiteEditor<unknown>,
  span: 40,
  async edit(session) {
    const suite = session as import('@mcthaydt/automata-editor-3d/suite').Levels3dSuiteSession
    const level = suite.level
    if (level.state.kind !== 'open') throw new Error(level.state.kind)
    const { editor } = level.state
    const { profile } = editor
    const first = profile.sectors.list(editor.history.state.level as never)[0]
    if (first === undefined) throw new Error('the level has no sector')
    editor.run({
      id: 'accept.light',
      label: 'Dim a sector',
      run: (p: typeof profile, value: unknown) =>
        ({
          ok: true as const,
          level: p.sectors.withSectors(
            value as never,
            p.sectors.list(value as never).map((s) => (s.id === first.id ? { ...s, light: 0.25 } : s)),
          ),
        }) as never,
    } as never)
    await level.settled()
    return level.path
  },
}

const studio: Probe = {
  editor: createStudio({
    stage: async () => undefined as never,
    frames: { request: () => 0, cancel: () => {} },
  }) as SuiteEditor<unknown>,
  span: 12,
  async edit(session) {
    const figures = (session as import('../editors/studio/studio-suite-editor').StudioSuiteSession).controller
      .session
    const figure = figures.content().figures.find((each) => each.value !== undefined)
    if (figure?.value === undefined) throw new Error('no figure')
    const height = figure.value.sliders.height
    const outcome = await figures.edit(
      figure.path,
      [{ keyPath: ['sliders', 'height'], expected: height, set: height + 1 }],
      'Set height',
    )
    if (!outcome.ok) throw new Error(outcome.message)
    return figure.path
  },
}

interface Game {
  readonly name: string
  readonly files: Record<string, string>
  /** The editors this game's list gives rows to. */
  readonly probes: readonly Probe[]
}

const emberwick: Game = {
  name: 'Emberwick (2D)',
  files: gameFiles(join(REPO, 'games/emberwick'), ['content/generated']),
  probes: [tuner, levels2d],
}

// base-3d keeps its content under `src/content` and has no editor list yet (logged in its EDITOR-GAPS.md): this is the
// list it would carry, one row per kind of file it has.
const BASE_3D_LIST = `format = "af-editors/1"
[[file]]
glob = "content/figure*/**/*.toml"
editor = "studio"
modes = ["edit"]
gates = []
checks = []

[[file]]
glob = "content/levels/*.af-sector.json"
editor = "levels-3d"
modes = ["edit"]
gates = []
checks = []
`
const base3d: Game = {
  name: 'base-3d (3D)',
  files: {
    ...gameFiles(join(REPO, 'games/base-3d/src'), ['content/generated']),
    [EDITOR_LIST_PATH]: BASE_3D_LIST,
  },
  probes: [studio, levels3d],
}

describe.each([emberwick, base3d])('EDS-y: the suite on $name', (game) => {
  it('loads the game’s editor list and gives every editor its files', async () => {
    const ports = await samplePorts(game.files)
    for (const probe of game.probes) {
      const rows = await ports.workspace.files(probe.editor.id)
      expect(rows.length, `${probe.editor.id} has files`).toBeGreaterThan(0)
      expect(rows.every((row) => row.writable)).toBe(true)
    }
  })

  describe.each(game.probes.map((probe) => [probe.editor.id, probe] as const))('%s', (_id, probe) => {
    async function opened(): Promise<{
      ports: SuitePorts
      suite: ReturnType<typeof createSuiteSession>
      session: unknown
    }> {
      const ports = await samplePorts(game.files)
      await ports.changeSet?.begin('Acceptance')
      const suite = createSuiteSession(ports)
      const files: WorkspaceFile[] = await ports.workspace.files(probe.editor.id)
      const session = await probe.editor.open(files, suite.portsFor(probe.editor.id))
      return { ports, suite, session }
    }

    it('edits one value, the file differs only there, and the suite’s Undo restores the bytes', async () => {
      const { ports, suite, session } = await opened()
      const path = await probe.edit(session)
      const original = game.files[path] as string
      const written = (await ports.workspace.read(path))?.text as string
      expect(written, `${path} changed`).not.toBe(original)
      const span = changedSpan(original, written)
      expect(span.removed.length, `the change is ${JSON.stringify(span)}`).toBeLessThanOrEqual(probe.span)
      expect(span.added.length).toBeLessThanOrEqual(probe.span)

      const undone = await suite.undo(probe.editor.id)
      expect(undone && 'written' in undone, 'Undo went through the write path').toBe(true)
      expect((await ports.workspace.read(path))?.text).toBe(original)
      expect(suite.writePath.canUndo(probe.editor.id)).toBe(false)
    })
  })
})

// The Undo audit's refusal half (plan step 4): a file the list makes read only refuses the write, the level editors take
// the step back, and the file and the history are as they were.
describe.each([
  [emberwick, levels2d],
  [base3d, levels3d],
])('Undo audit: a refused write on %s', (game, probe) => {
  it(`${probe.editor.id} leaves the file untouched, takes the step back and says why`, async () => {
    const readOnly = { ...game.files, [EDITOR_LIST_PATH]: 'format = "not-a-list"' }
    const ports = await samplePorts(readOnly)
    const suite = createSuiteSession(ports)
    const files: WorkspaceFile[] = await ports.workspace.files(probe.editor.id)
    // With no loadable list nothing is classed, so open the row group by hand over the game's own files.
    const group = Object.keys(game.files)
      .filter((path) =>
        probe.editor.id === 'levels-2d' ? path.endsWith('.af2d.json') : path.endsWith('.af-sector.json'),
      )
      .map(
        (path): WorkspaceFile =>
          ({
            path,
            editor: probe.editor.id,
            gates: [],
            checks: [],
            modes: ['edit'],
            writable: false,
            why: 'read only',
          }) as WorkspaceFile,
      )
    expect(files).toEqual([])
    type Level = { refusal: string | undefined; path: string; settled(): Promise<void> }
    const opened = await probe.editor.open(group, suite.portsFor(probe.editor.id))
    const session = ('level' in (opened as object) ? (opened as { level: Level }).level : opened) as Level
    const before = (await ports.workspace.read(session.path))?.text
    await probe.edit(opened).catch(() => undefined)
    await session.settled()
    expect(session.refusal, 'the refusal is kept').toBeTruthy()
    expect((await ports.workspace.read(session.path))?.text).toBe(before)
    expect(suite.writePath.canUndo(probe.editor.id)).toBe(false)
  })
})
