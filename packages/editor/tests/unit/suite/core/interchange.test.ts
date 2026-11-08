import { parse as parseToml } from 'smol-toml'
import { describe, expect, test } from 'vitest'
import {
  applyImport,
  exportInterchange,
  type ImportPlan,
  interchangeSchema,
  planImport,
} from '#src/features/suite/core/interchange.ts'
import sampleList from '#src/features/suite/shell/platformer.editors.toml?raw'
import { loadEditorList } from '#src/shared/editor-list/editor-list.ts'
import { EDITOR_LIST_PATH } from '#src/shared/editor-list/editors.schema.ts'
import { workspaceFile } from '#src/shared/editor-list/workspace-policy.ts'
import { createWritePath } from '#src/shared/editor-list/write-path.ts'
import { createMemoryPorts } from '#src/shared/kit/ports/memory/memory-ports.ts'
import bayList from '#src/testing/suite/fixtures/bay.editors.toml?raw'

// An excerpt of FloorFifty's content/tuning.toml (SNEKPRTY/FloorFifty 677d456, the kit's documents fixture).
const TUNING = 'content/tuning.toml'
const TUNING_TEXT = `# Base gameplay tuning.

# Applied on contact with any face of a floor, not only from above.
BOUNCE_VELOCITY = 268.2
MAX_MOVE_SPEED = 356.0
FAST_FALL_VELOCITY = -1341.0

# \`540 / 4.2\`, written to the precision that round-trips.
FLOOR_GAP_MIN = 128.57142857142856
`
const STAGE = 'content/stages/floor-01.toml'
const STAGE_TEXT = 'id = "floor-01"\nwidth = 120\n'

const loaded = (text: string) => {
  const load = loadEditorList(text)
  if (!load.ok) throw new Error('fixture list does not load')
  return load.list
}
const PLATFORMER = loaded(sampleList)
const BAY = loaded(bayList)

async function platformer(extra: Readonly<Record<string, string>> = {}) {
  const memory = await createMemoryPorts({
    files: { [EDITOR_LIST_PATH]: sampleList, [TUNING]: TUNING_TEXT, [STAGE]: STAGE_TEXT, ...extra },
    classify: (path) => workspaceFile(PLATFORMER, path),
  })
  const writePath = createWritePath({ ports: memory.ports, title: async () => 'Import' })
  const { workspace } = memory.ports
  const plan = (text: string, options: { installed?: readonly string[]; locked?: readonly string[] } = {}) =>
    planImport(text, {
      list: PLATFORMER,
      read: (path) => workspace.read(path),
      installed: options.installed ?? ['tuner', 'levels-2d'],
      locked: () => options.locked ?? [],
    })
  return { ...memory, writePath, plan }
}

const exported = (format: 'toml' | 'json' = 'toml') =>
  exportInterchange(
    [
      { path: TUNING, editor: 'tuner', text: TUNING_TEXT },
      { path: STAGE, editor: 'levels-2d', text: STAGE_TEXT },
    ],
    { format, commit: 'a1b2c3d' },
  )

const changesOf = (plan: ImportPlan) => {
  if ('error' in plan) throw new Error(plan.error)
  return plan
}

describe('scene-interchange v2 export (spec §4.8)', () => {
  test('TOML and JSON exports parse back through the schema with the values, commit and scene', () => {
    for (const format of ['toml', 'json'] as const) {
      const text = exported(format)
      const value = format === 'toml' ? parseToml(text) : JSON.parse(text)
      const document = interchangeSchema.parse(value)
      expect(document).toMatchObject({
        format: 'scene-interchange',
        version: 2,
        source: { commit: 'a1b2c3d' },
      })
      expect(document.sections.tuner?.[TUNING]).toMatchObject({ MAX_MOVE_SPEED: 356 })
      expect(document.sections['levels-2d']?.[STAGE]).toEqual({ id: 'floor-01', width: 120 })
    }
    const scened = exportInterchange([], { format: 'json', scene: 'bay' })
    expect(interchangeSchema.parse(JSON.parse(scened)).scene).toBe('bay')
  })

  test('keys are sorted and two exports are byte-identical (no clock)', () => {
    const text = exported('json')
    expect(text).toBe(exported('json'))
    const keys = Object.keys(JSON.parse(text).sections.tuner[TUNING])
    expect(keys).toEqual([...keys].sort())
  })

  test('another format or version is refused with what was found', async () => {
    const { plan } = await platformer()
    const v1 = JSON.stringify({ format: 'scene-interchange', version: 1, sections: {} })
    expect(await plan(v1)).toEqual({
      error: 'scene-interchange version 1 is not supported; this suite reads version 2',
    })
    expect(await plan('{"format":"other"}')).toMatchObject({ error: expect.stringContaining('other') })
    expect(await plan('not = [toml')).toMatchObject({ error: expect.stringContaining('does not parse') })
  })
})

describe('the import plan (spec §4.8, §11)', () => {
  test('EDS-o: change MAX_MOVE_SPEED in a TOML export; the plan has that one change, no gates, its checks', async () => {
    const { plan } = await platformer()
    const edited = exported('toml').replace('MAX_MOVE_SPEED = 356', 'MAX_MOVE_SPEED = 400')
    const result = changesOf(await plan(edited))
    expect(result.refused).toEqual([])
    expect(result.applicable).toBe(true)
    expect(result.changes).toHaveLength(1)
    const [change] = result.changes
    expect(change).toMatchObject({
      path: TUNING,
      editor: 'tuner',
      gates: [],
      checks: ['content', 'content-check'],
    })
    expect(change?.after).toBe(TUNING_TEXT.replace('MAX_MOVE_SPEED = 356.0', 'MAX_MOVE_SPEED = 400.0'))
    expect(change?.hunks.flatMap((hunk) => hunk.lines.filter((line) => line.kind !== 'same'))).toEqual([
      expect.objectContaining({ kind: 'removed', text: 'MAX_MOVE_SPEED = 356.0\n' }),
      expect.objectContaining({ kind: 'added', text: 'MAX_MOVE_SPEED = 400.0\n' }),
    ])
  })

  test('EDS-p: an export imported unchanged is an empty plan that cannot apply', async () => {
    const { plan } = await platformer()
    for (const format of ['toml', 'json'] as const) {
      const result = changesOf(await plan(exported(format)))
      expect(result).toEqual({ changes: [], refused: [], applicable: false })
    }
  })

  test('EDS-p2: a sequence section in the free build is refused as not installed; the rest still applies', async () => {
    const { plan } = await platformer()
    const document = JSON.parse(exported('json'))
    document.sections.tuner[TUNING].MAX_MOVE_SPEED = 400
    document.sections.sequence = { 'content/cutscenes/intro.toml': { shots: 1 } }
    const result = changesOf(await plan(JSON.stringify(document)))
    expect(result.refused).toEqual([
      { editor: 'sequence', reason: 'not-installed', why: 'editor not installed' },
    ])
    expect(result.changes.map((change) => change.path)).toEqual([TUNING])
    expect(result.applicable).toBe(true)
  })

  test('an unlisted path, a never path, a wrong editor and a locked key are refused and disable Apply', async () => {
    const { plan } = await platformer({ 'package.json': '{}\n' })
    const document = JSON.parse(exported('json'))
    document.sections.tuner[TUNING].MAX_MOVE_SPEED = 400
    document.sections.tuner['src/main.ts'] = { a: 1 }
    document.sections.tuner['package.json'] = { name: 'x' }
    document.sections.tuner[STAGE] = { id: 'floor-02' }
    const result = changesOf(await plan(JSON.stringify(document), { locked: ['MAX_MOVE_SPEED'] }))
    expect(result.refused.map(({ path, reason }) => [path, reason])).toEqual([
      [STAGE, 'editor-mismatch'],
      [TUNING, 'locked'],
      ['package.json', 'read-only'],
      ['src/main.ts', 'unlisted'],
    ])
    expect(result.refused[1]?.why).toContain('MAX_MOVE_SPEED')
    expect(result.applicable).toBe(false)
  })

  test('a path that does not exist yet is planned as created, printed from its value', async () => {
    const { plan } = await platformer()
    const document = JSON.parse(exportInterchange([], { format: 'json' }))
    document.sections['levels-2d'] = { 'content/stages/floor-02.toml': { id: 'floor-02' } }
    const result = changesOf(await plan(JSON.stringify(document)))
    expect(result.changes).toEqual([
      expect.objectContaining({
        path: 'content/stages/floor-02.toml',
        expected: 'absent',
        after: 'id = "floor-02"\n',
      }),
    ])
    expect(result.changes[0]?.before).toBeUndefined()
  })

  test('a key added and a key dropped become an insert and a remove; comments survive', async () => {
    const { plan } = await platformer()
    const document = JSON.parse(exported('json'))
    delete document.sections.tuner[TUNING].FAST_FALL_VELOCITY
    document.sections.tuner[TUNING].PLAYER_WIDTH = 59
    const after = changesOf(await plan(JSON.stringify(document))).changes[0]?.after ?? ''
    expect(after).not.toContain('FAST_FALL_VELOCITY')
    expect(after).toContain('PLAYER_WIDTH = 59')
    expect(after).toContain('# `540 / 4.2`, written to the precision that round-trips.')
  })

  test('a scene export of the adventure source keeps each section under its row', async () => {
    const story = 'content/scenes/bay/story.toml'
    const memory = await createMemoryPorts({
      files: { [story]: 'title = "Bay"\n' },
      classify: (path) => workspaceFile(BAY, path),
    })
    const text = exportInterchange([{ path: story, editor: 'writer', text: 'title = "Bay"\n' }], {
      format: 'toml',
      scene: 'bay',
    })
    const result = await planImport(text.replace('"Bay"', '"The Bay"'), {
      list: BAY,
      read: (path) => memory.ports.workspace.read(path),
      installed: ['writer'],
      locked: () => [],
    })
    expect(changesOf(result).changes.map((change) => change.after)).toEqual(['title = "The Bay"\n'])
  })
})

describe('apply (one change-set undo step, EDS-D19)', () => {
  test('EDS-o: Apply writes the file once, journals it, and one Undo puts it back', async () => {
    const { ports, plan, writePath, changeSet } = await platformer()
    const result = await plan(exported('toml').replace('MAX_MOVE_SPEED = 356', 'MAX_MOVE_SPEED = 400'))
    expect(await applyImport(result, writePath)).toMatchObject({ written: true })
    expect((await ports.workspace.read(TUNING))?.text).toContain('MAX_MOVE_SPEED = 400.0')
    expect((await changeSet?.list())?.[0]?.writes.map((write) => write.path)).toEqual([TUNING])
    expect(writePath.undoLabel()).toBe('Import')
    await writePath.undo()
    expect((await ports.workspace.read(TUNING))?.text).toBe(TUNING_TEXT)
  })

  test('a file changed after the plan refuses the apply and writes nothing', async () => {
    const { ports, plan, writePath } = await platformer()
    const result = await plan(exported('toml').replace('MAX_MOVE_SPEED = 356', 'MAX_MOVE_SPEED = 400'))
    const current = await ports.workspace.read(TUNING)
    await ports.workspace.write(TUNING, `${TUNING_TEXT}# moved\n`, { mtime: current?.mtime ?? 0 })
    expect(await applyImport(result, writePath)).toEqual({ refused: 'moved', path: TUNING })
    expect((await ports.workspace.read(TUNING))?.text).toBe(`${TUNING_TEXT}# moved\n`)
    expect(writePath.canUndo()).toBe(false)
  })

  test('a plan that cannot apply writes nothing', async () => {
    const { plan, writePath } = await platformer()
    expect(await applyImport(await plan(exported('toml')), writePath)).toEqual({ refused: 'plan' })
    expect(writePath.canUndo()).toBe(false)
  })
})
