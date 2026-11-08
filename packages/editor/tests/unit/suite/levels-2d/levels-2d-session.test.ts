import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { levels2dUndo, openLevels2d } from '#src/app/suite/levels-2d/levels-2d-session.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { createSuiteSession } from '#src/features/suite/shell/suite-session.ts'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// The Levels 2D session in Node: it is opened over the
// suite's ports, holds the document's history and the Level view's session, and writes every new step through the
// suite's workspace. The platformer's `level-1` is 512 × 288 on a 16 px grid; the view opens on its entity layer, so a tap places one.

const PATH = 'content/levels/world.af2d.json'

const file = (path: string): WorkspaceFile => ({
  path,
  editor: 'levels-2d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
})

async function setup(text = levelProject.print('', platformerTemplate.create(counterIds()))) {
  const memory = await createMemoryPorts({ files: { [PATH]: text }, classify: file })
  const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
  return { ports: memory.ports, session }
}

describe('Levels 2D session', () => {
  it('opens the row group’s level project on its first level', async () => {
    const { session } = await setup()
    expect(session.path).toBe(PATH)
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    expect(session.state.level.editor.view.level).toBe('level-1')
  })

  it('makes a broken file a state, not a rejection', async () => {
    const { session } = await setup('{ "format": "af2d", ')
    expect(session.state.kind).toBe('error')
    if (session.state.kind === 'error') expect(session.state.message).toMatch(/can’t be opened/)
  })

  it('adapts the document’s history to the suite’s Undo, and writes each new step', async () => {
    const { ports, session } = await setup()
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    const undo = levels2dUndo(session)
    expect(undo.canUndo()).toBe(false)
    let heard = 0
    undo.subscribe(() => (heard += 1))

    const { editor } = session.state.level
    editor.pointerDown({ x: 8, y: 8 })
    editor.pointerUp()
    expect(undo.canUndo()).toBe(true)
    expect(undo.undoLabel()).toBe('Place entity')
    expect(heard).toBeGreaterThan(0)
    await session.settled()
    const written = await ports.workspace.read(PATH)
    expect(written?.text).toBe(levelProject.print('', session.state.history.state as Project))

    undo.undo()
    expect(undo.canUndo()).toBe(false)
    expect(undo.canRedo()).toBe(true)
    await session.settled()
    // The suite's write path puts the file back on Undo; the session's own Undo does not write it again.
    expect((await ports.workspace.read(PATH))?.text).toBe(written?.text)
  })

  it('takes a step back when the workspace refuses its write, and says why', async () => {
    const memory = await createMemoryPorts({
      files: { [PATH]: levelProject.print('', platformerTemplate.create(counterIds())) },
      classify: (path) => ({ ...file(path), writable: false, why: 'generated' }),
    })
    const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    session.state.level.editor.pointerDown({ x: 8, y: 8 })
    session.state.level.editor.pointerUp()
    await session.settled()
    expect(session.state.history.canUndo).toBe(false)
    expect(session.refusal).toMatch(/generated/)
  })

  describe('on a game that exports', () => {
    const exportingFile = (path: string): WorkspaceFile => ({ ...file(path), exports: 'content' })

    async function game() {
      const memory = await createMemoryPorts({
        files: { [PATH]: levelProject.print('', platformerTemplate.create(counterIds())) },
        classify: exportingFile,
      })
      const suite = createSuiteSession(memory.ports)
      const session = await openLevels2d([exportingFile(PATH)], suite.portsFor('levels-2d'), {
        ids: counterIds(500),
      })
      if (session.state.kind !== 'open') throw new Error(session.state.kind)
      return { memory, suite, session, level: session.state.level }
    }

    it('writes the game’s files with the project, so the game reads what was drawn', async () => {
      const { memory, session, level } = await game()
      level.editor.pointerDown({ x: 8, y: 8 })
      level.editor.pointerUp()
      await session.settled()
      expect(session.refusal).toBeUndefined()
      for (const path of ['content/project.toml', 'content/world.toml', 'content/levels/level-1.toml'])
        expect((await memory.ports.workspace.read(path))?.text, path).toContain(
          'Generated by the Automata 2D editor',
        )
    })

    it('puts every one of those files back with one Undo of the suite', async () => {
      const { memory, suite, session, level } = await game()
      level.editor.pointerDown({ x: 8, y: 8 })
      level.editor.pointerUp()
      await session.settled()
      const before = (await memory.ports.workspace.read('content/levels/level-1.toml'))?.text
      level.editor.pointerDown({ x: 24, y: 24 })
      level.editor.pointerUp()
      await session.settled()
      expect((await memory.ports.workspace.read('content/levels/level-1.toml'))?.text).not.toBe(before)
      await suite.undo('levels-2d')
      expect((await memory.ports.workspace.read('content/levels/level-1.toml'))?.text).toBe(before)
    })

    /** The project changed somewhere else after it was opened, then the person draws another step. */
    async function conflicted() {
      const opened = await game()
      const { memory, session, level } = opened
      level.editor.pointerDown({ x: 8, y: 8 })
      level.editor.pointerUp()
      await session.settled()
      const theirs = `${(await memory.ports.workspace.read(PATH))?.text ?? ''}\n`
      await memory.ports.workspace.write(PATH, theirs, {
        mtime: (await memory.ports.workspace.read(PATH))?.mtime ?? 0,
      })
      const projectBefore = (await memory.ports.workspace.read('content/levels/level-1.toml'))?.text
      level.editor.pointerDown({ x: 40, y: 40 })
      level.editor.pointerUp()
      await session.settled()
      return { ...opened, theirs, projectBefore }
    }

    it('writes nothing of the game when the project moved on disk, keeps the step, and says so', async () => {
      const { memory, session, projectBefore } = await conflicted()
      expect(session.refusal).toMatch(/changed/)
      expect(get(session.conflict)).toBe(true)
      expect(session.state.kind === 'open' && session.state.history.canUndo).toBe(true)
      expect((await memory.ports.workspace.read('content/levels/level-1.toml'))?.text).toBe(projectBefore)
    })

    it('Use mine writes the step and the game’s files over the other version', async () => {
      const { memory, session, theirs, projectBefore } = await conflicted()
      await session.keepMine()
      expect(get(session.conflict)).toBe(false)
      expect(session.refusal).toBeUndefined()
      expect((await memory.ports.workspace.read(PATH))?.text).not.toBe(theirs)
      expect((await memory.ports.workspace.read('content/levels/level-1.toml'))?.text).not.toBe(projectBefore)
      // The next step writes as before.
      if (session.state.kind !== 'open') throw new Error(session.state.kind)
      session.state.level.editor.pointerDown({ x: 56, y: 56 })
      session.state.level.editor.pointerUp()
      await session.settled()
      expect(session.refusal).toBeUndefined()
    })

    it('Use theirs takes the other version in and drops the step', async () => {
      const { memory, session, theirs } = await conflicted()
      await session.takeTheirs()
      expect(get(session.conflict)).toBe(false)
      expect(session.refusal).toBeUndefined()
      if (session.state.kind !== 'open') throw new Error(session.state.kind)
      const taken = levelProject.parse(theirs)
      if (!taken.ok) throw new Error('their version does not parse')
      expect(session.state.history.state).toEqual(taken.value)
      const onDisk = levelProject.parse((await memory.ports.workspace.read(PATH))?.text ?? '')
      expect(onDisk.ok && onDisk.value).toEqual(taken.value)
    })
  })

  describe('pictures', () => {
    const PICTURE = new Uint8Array([137, 80, 78, 71])

    it('reads a level’s pictures from the workspace unless the host brings its own reader', async () => {
      const memory = await createMemoryPorts({
        files: { [PATH]: levelProject.print('', platformerTemplate.create(counterIds())) },
        classify: file,
      })
      await memory.ports.workspace.writeBytes?.('assets/tiles.png', PICTURE, 'absent')
      const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
      expect(await session.read('assets/tiles.png')).toEqual(PICTURE)
      expect(await session.read('assets/none.png')).toBeUndefined()
      const own = await openLevels2d([file(PATH)], memory.ports, {
        ids: counterIds(500),
        read: () => Promise.resolve(new Uint8Array([1])),
      })
      expect(await own.read('assets/tiles.png')).toEqual(new Uint8Array([1]))
    })

    it('adds a picture to the game the way Add tiles writes it, never over a file that is there', async () => {
      const memory = await createMemoryPorts({
        files: { [PATH]: levelProject.print('', platformerTemplate.create(counterIds())) },
        classify: file,
      })
      const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
      const files = session.files
      expect(files).toBeDefined()
      expect(await files?.write('assets/tiles.png', PICTURE, 'absent')).toMatchObject({ ok: true })
      expect((await files?.list('assets/'))?.map((entry) => entry.path)).toEqual(['assets/tiles.png'])
      expect(await files?.write('assets/tiles.png', PICTURE, 'absent')).toMatchObject({
        ok: false,
        reason: 'conflict',
      })
    })
  })
})

describe('Levels 2D on a game with no level yet (the try-it sample)', () => {
  const exportingFile = (path: string): WorkspaceFile => ({ ...file(path), exports: 'content' })

  async function sample(options: { templates?: string } = { templates: 'content/levels' }) {
    const memory = await createMemoryPorts({ files: {}, classify: exportingFile })
    const suite = createSuiteSession(memory.ports)
    const session = await openLevels2d([], suite.portsFor('levels-2d'), { ids: counterIds(500), ...options })
    return { memory, session }
  }

  it('waits for a starting point, with the profile’s templates to pick from', async () => {
    const { session } = await sample()
    expect(session.state.kind).toBe('empty')
    if (session.state.kind !== 'empty') return
    expect(session.state.cards.map((card) => card.label)).toContain('Platformer')
  })

  it('without templates it is the error it always was: there is no such file', async () => {
    const { session } = await sample({})
    expect(session.state.kind).toBe('error')
  })

  it('writes the chosen template as the level, and the same session opens on it', async () => {
    const { memory, session } = await sample()
    await session.start('level-project', 'platformer')
    expect(session.path).toBe('content/levels/untitled-platformer.af2d.json')
    expect(session.state.kind).toBe('open')
    expect((await memory.ports.workspace.read(session.path))?.text).toContain('"levels"')
    // The first step on it is written like any other, with the game's files.
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    const before = (await memory.ports.workspace.read(session.path))?.text
    session.state.level.editor.pointerDown({ x: 8, y: 8 })
    session.state.level.editor.pointerUp()
    await session.settled()
    expect((await memory.ports.workspace.read(session.path))?.text).not.toBe(before)
    expect((await memory.ports.workspace.read('content/project.toml'))?.text).toContain(
      'Generated by the Automata 2D editor',
    )
  })

  it('tells the status line when the level could not be made, and stays on the starting points', async () => {
    const memory = await createMemoryPorts({
      files: {},
      classify: (path) => ({ ...exportingFile(path), writable: false, why: 'Read only.' }),
    })
    const session = await openLevels2d([], memory.ports, {
      ids: counterIds(500),
      templates: 'content/levels',
    })
    await session.start('level-project', 'platformer')
    expect(session.state.kind).toBe('empty')
    expect(get(session.refused)).toMatch(/Read only/)
  })
})
