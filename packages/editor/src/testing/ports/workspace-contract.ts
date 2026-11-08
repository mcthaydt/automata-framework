import { describe, expect, test } from 'vitest'
import type { ChangeSet, SuiteWorkspace } from '../../shared/kit/ports/suite-ports'

/**
 * The game an adapter under the workspace contract is built on: these files, `content/editors.toml` among them. The
 * adapter takes its policy from that list (editor-suite's `fileAccess`, through `workspaceFile`), as the disk adapter does with a real checkout, so nothing here restates the policy.
 */
export interface WorkspaceScenario {
  readonly files: Readonly<Record<string, string>>
}

const TUNING = 'content/tuning.toml'
const LEVEL = 'content/scenes/bay/level.json'
const NEW_POSE = 'content/figures/poses/wave.toml'
const META = 'content/generated/tuning-meta.json'
const LIST = 'content/editors.toml'

/** An `af-editors/1` list: four rows, one gate, the generated outputs; the list itself is never written. */
export const WORKSPACE_EDITORS_TOML = `format = "af-editors/1"
scenes = "content/scenes/{scene}/"
generated = ["content/generated/**"]
never = []

[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit", "ask"]
gates = []
checks = ["content"]

[[file]]
glob = "content/scenes/{scene}/level.json"
editor = "levels-3d"
modes = ["edit"]
gates = ["S-G1"]
checks = ["content"]

[[file]]
glob = "content/figures/poses/*.toml"
editor = "studio"
modes = ["edit", "ask"]
gates = []
checks = ["content"]

[[file]]
glob = "content/generated/*.json"
editor = "tuner"
modes = ["edit"]
gates = []
checks = []

[[gate]]
id = "S-G1"
name = "Scene blockout"
records = "docs/gates/**/gates.json"
`

export const WORKSPACE_SCENARIO: WorkspaceScenario = {
  files: {
    [LIST]: WORKSPACE_EDITORS_TOML,
    [TUNING]: 'MAX_MOVE_SPEED = 6.0 # m/s\n',
    [LEVEL]: '{ "sectors": [] }\n',
    [META]: '{ "MAX_MOVE_SPEED": { "min": 1, "max": 12 } }\n',
    'README.md': '# A game\n',
  },
}

/** A workspace over `WORKSPACE_SCENARIO`, and the change set whose journal records what the workspace creates. */
export type MakeWorkspace = (
  scenario: WorkspaceScenario,
) => Promise<{ readonly workspace: SuiteWorkspace; readonly changeSet: ChangeSet }>

/** The listed files the scenario's list gives; `why` is matched loosely, since each adapter words its own. */
const EXPECTED_FILES = {
  [META]: {
    path: META,
    editor: 'tuner',
    gates: [],
    checks: [],
    modes: ['edit'],
    writable: false,
    why: expect.stringMatching(/generated/),
  },
  [LEVEL]: {
    path: LEVEL,
    editor: 'levels-3d',
    scene: 'bay',
    gates: ['S-G1'],
    checks: ['content'],
    modes: ['edit'],
    writable: true,
  },
  [TUNING]: {
    path: TUNING,
    editor: 'tuner',
    gates: [],
    checks: ['content'],
    modes: ['edit', 'ask'],
    writable: true,
  },
} as const

/**
 * What every `SuiteWorkspace` promises, run against the in-memory fake and the disk adapter, each built fresh on the same scenario per test.
 */
export function describeSuiteWorkspace(name: string, make: MakeWorkspace): void {
  describe(`SuiteWorkspace contract: ${name}`, () => {
    const open = () => make(WORKSPACE_SCENARIO)

    test('files lists the existing files a row matches, sorted by path; a generated one read only with the reason', async () => {
      const { workspace } = await open()
      expect(await workspace.files()).toEqual([
        EXPECTED_FILES[META],
        EXPECTED_FILES[LEVEL],
        EXPECTED_FILES[TUNING],
      ])
    })

    test('files narrows to one editor, or to one scene', async () => {
      const { workspace } = await open()
      expect((await workspace.files('tuner')).map((file) => file.path)).toEqual([META, TUNING])
      expect((await workspace.files(undefined, 'bay')).map((file) => file.path)).toEqual([LEVEL])
      expect(await workspace.files('feel')).toEqual([])
    })

    test('read gives text and mtime of any file, a file no row matches included; a missing file is undefined', async () => {
      const { workspace } = await open()
      expect(await workspace.read(TUNING)).toEqual({
        text: 'MAX_MOVE_SPEED = 6.0 # m/s\n',
        mtime: expect.any(Number),
      })
      expect((await workspace.read('README.md'))?.text).toBe('# A game\n')
      expect(await workspace.read('content/nothing.toml')).toBeUndefined()
    })

    test('a write at the mtime it was read with goes through and gives the new mtime', async () => {
      const { workspace } = await open()
      const before = await workspace.read(TUNING)
      if (before === undefined) throw new Error('the scenario has the tuning file')
      const written = await workspace.write(TUNING, 'MAX_MOVE_SPEED = 7.5 # m/s\n', { mtime: before.mtime })
      expect(written.ok).toBe(true)
      const after = await workspace.read(TUNING)
      expect(after?.text).toBe('MAX_MOVE_SPEED = 7.5 # m/s\n')
      if (written.ok) expect(after?.mtime).toBe(written.mtime)
    })

    test('a write at another mtime is a conflict and changes nothing', async () => {
      const { workspace } = await open()
      const before = await workspace.read(TUNING)
      if (before === undefined) throw new Error('the scenario has the tuning file')
      const refused = await workspace.write(TUNING, 'MAX_MOVE_SPEED = 1\n', { mtime: before.mtime - 1000 })
      expect(refused).toMatchObject({ ok: false, reason: 'conflict' })
      expect(await workspace.read(TUNING)).toEqual(before)
    })

    test("a write expecting 'absent' creates a file a row allows, which files then lists", async () => {
      const { workspace } = await open()
      expect(await workspace.write(NEW_POSE, 'name = "wave"\n', 'absent')).toMatchObject({ ok: true })
      expect((await workspace.read(NEW_POSE))?.text).toBe('name = "wave"\n')
      expect((await workspace.files('studio')).map((file) => file.path)).toEqual([NEW_POSE])
    })

    test("a write expecting 'absent' over an existing file is a conflict and changes nothing", async () => {
      const { workspace } = await open()
      const before = await workspace.read(TUNING)
      expect(await workspace.write(TUNING, 'x = 1\n', 'absent')).toMatchObject({
        ok: false,
        reason: 'conflict',
      })
      expect(await workspace.read(TUNING)).toEqual(before)
    })

    test('a write to a read-only row is refused by policy with its reason, and changes nothing', async () => {
      const { workspace } = await open()
      const before = await workspace.read(META)
      if (before === undefined) throw new Error('the scenario has the generated file')
      const refused = await workspace.write(META, '{}\n', { mtime: before.mtime })
      expect(refused).toMatchObject({ ok: false, reason: 'policy' })
      expect(refused.ok === false && refused.message).toMatch(/generated/)
      expect(await workspace.read(META)).toEqual(before)
    })

    test('a write no row matches is refused by policy, the editor list itself included, and nothing is created', async () => {
      const { workspace } = await open()
      const list = await workspace.read(LIST)
      if (list === undefined) throw new Error('the scenario has the editor list')
      const refusedList = await workspace.write(LIST, 'format = "af-editors/1"\n[[file]]\n', {
        mtime: list.mtime,
      })
      expect(refusedList).toMatchObject({ ok: false, reason: 'policy' })
      expect(refusedList.ok === false && refusedList.message.length > 0).toBe(true)
      expect(await workspace.read(LIST)).toEqual(list)
      expect(await workspace.write('content/stray.toml', 'x = 1\n', 'absent')).toMatchObject({
        ok: false,
        reason: 'policy',
      })
      expect(await workspace.read('content/stray.toml')).toBeUndefined()
    })

    test('remove takes a file the open change set created, at its mtime', async () => {
      const { workspace, changeSet } = await open()
      await changeSet.begin('A wave pose')
      const created = await workspace.write(NEW_POSE, 'name = "wave"\n', 'absent')
      if (!created.ok) throw new Error('the create should go through')
      expect(await workspace.remove(NEW_POSE, { mtime: created.mtime })).toMatchObject({ ok: true })
      expect(await workspace.read(NEW_POSE)).toBeUndefined()
    })

    test('remove of a file the change set created, after it changed, is a conflict and the file stays', async () => {
      const { workspace, changeSet } = await open()
      await changeSet.begin('A wave pose')
      const created = await workspace.write(NEW_POSE, 'name = "wave"\n', 'absent')
      if (!created.ok) throw new Error('the create should go through')
      const edited = await workspace.write(NEW_POSE, 'name = "wave 2"\n', { mtime: created.mtime })
      if (!edited.ok) throw new Error('the edit should go through')
      expect(await workspace.remove(NEW_POSE, { mtime: created.mtime })).toMatchObject({
        ok: false,
        reason: 'conflict',
      })
      expect((await workspace.read(NEW_POSE))?.text).toBe('name = "wave 2"\n')
    })

    test('remove of a file the change set did not create is refused by policy, and the file stays', async () => {
      const { workspace, changeSet } = await open()
      await changeSet.begin('Faster')
      const before = await workspace.read(TUNING)
      if (before === undefined) throw new Error('the scenario has the tuning file')
      expect(await workspace.remove(TUNING, { mtime: before.mtime })).toMatchObject({
        ok: false,
        reason: 'policy',
      })
      expect(await workspace.read(TUNING)).toEqual(before)
    })

    test('remove is refused by policy for a file made with no change set open, and with one open', async () => {
      const { workspace, changeSet } = await open()
      const unrecorded = await workspace.write(NEW_POSE, 'name = "wave"\n', 'absent')
      if (!unrecorded.ok) throw new Error('the create should go through')
      expect(await workspace.remove(NEW_POSE, { mtime: unrecorded.mtime })).toMatchObject({
        ok: false,
        reason: 'policy',
      })
      await changeSet.begin('A pose')
      expect(await workspace.remove(NEW_POSE, { mtime: unrecorded.mtime })).toMatchObject({
        ok: false,
        reason: 'policy',
      })
      expect(await workspace.read(NEW_POSE)).toBeDefined()
    })

    test('remove is refused by policy for a file an earlier change set created', async () => {
      const { workspace, changeSet } = await open()
      await changeSet.begin('A pose')
      const created = await workspace.write(NEW_POSE, 'name = "wave"\n', 'absent')
      if (!created.ok) throw new Error('the create should go through')
      await changeSet.close()
      await changeSet.begin('Another')
      expect(await workspace.remove(NEW_POSE, { mtime: created.mtime })).toMatchObject({
        ok: false,
        reason: 'policy',
      })
      expect(await workspace.read(NEW_POSE)).toBeDefined()
    })

    test('outside the root, a read is nothing and a write or remove is refused by policy, creating nothing', async () => {
      const { workspace } = await open()
      for (const path of [
        '../outside.toml',
        'content/../../outside.toml',
        '/etc/passwd',
        'content\\tuning.toml',
      ]) {
        expect(await workspace.read(path), path).toBeUndefined()
        expect(await workspace.write(path, 'x = 1\n', 'absent'), path).toMatchObject({
          ok: false,
          reason: 'policy',
        })
        expect(await workspace.write(path, 'x = 1\n', { mtime: 1 }), path).toMatchObject({
          ok: false,
          reason: 'policy',
        })
        expect(await workspace.remove(path, { mtime: 1 }), path).toMatchObject({
          ok: false,
          reason: 'policy',
        })
        expect(await workspace.generated(path), path).toBeUndefined()
      }
      expect((await workspace.files()).map((file) => file.path)).toEqual([META, LEVEL, TUNING])
    })

    test('generated reads a compiler output; anything else is undefined', async () => {
      const { workspace } = await open()
      expect(await workspace.generated(META)).toBe('{ "MAX_MOVE_SPEED": { "min": 1, "max": 12 } }\n')
      expect(await workspace.generated(TUNING)).toBeUndefined()
      expect(await workspace.generated('content/generated/none.json')).toBeUndefined()
    })
  })
}
