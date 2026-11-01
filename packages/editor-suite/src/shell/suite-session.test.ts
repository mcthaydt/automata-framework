import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { describe, expect, test } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '../core'
import sampleList from '../testing/fixtures/sample-game.editors.toml?raw'
import { createSuiteSession } from './suite-session'

const TUNING = 'content/tuning.toml'
const FILES = {
  [EDITOR_LIST_PATH]: sampleList,
  [TUNING]: 'MAX_MOVE_SPEED = 356.0\n',
}

async function setup(options: { changeSet?: false; gh?: boolean } = {}) {
  const load = loadEditorList(sampleList)
  if (!load.ok) throw new Error('fixture list does not load')
  const memory = await createMemoryPorts({
    files: FILES,
    classify: (path) => workspaceFile(load.list, path),
    changeSet: options.changeSet === false ? false : { gh: options.gh ?? false },
  })
  const session = createSuiteSession(memory.ports, { installed: ['tuner', 'levels-2d'] })
  return { ...memory, session }
}

/** Writes once through the session, answering the title prompt. */
async function edit(session: ReturnType<typeof createSuiteSession>, text: string) {
  const writing = session.ports.workspace.write(TUNING, text, { mtime: 0 })
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  session.answerTitle('Faster')
  return writing
}

describe('the session behind Ship, the Review desk and the interchange (EDS.2c)', () => {
  test('without a change set port there is no Ship and the Review desk lists nothing', async () => {
    const { session } = await setup({ changeSet: false })
    expect(session.canShip()).toBe(false)
    expect(await session.review()).toEqual([])
  })

  test('the Review desk reads each open change set from the journal, with its diff', async () => {
    const { session } = await setup()
    await edit(session, 'MAX_MOVE_SPEED = 400.0\n')
    const [review] = await session.review()
    expect(review).toMatchObject({
      title: 'Faster',
      files: [{ path: TUNING, after: 'MAX_MOVE_SPEED = 400.0\n' }],
    })
    expect(review?.gates).toEqual({ reopened: [], unreadable: 'Gates not readable' })
  })

  test('EDS-j: Ship drafts the description, then gives a draft PR with gh and only the compare link without', async () => {
    for (const gh of [true, false]) {
      const { session } = await setup({ gh })
      await edit(session, 'MAX_MOVE_SPEED = 400.0\n')
      const draft = await session.draft()
      expect(draft?.title).toBe('Faster')
      expect(draft?.body).toContain(`- \`${TUNING}\``)
      const result = await session.ship({ title: 'Faster', body: draft?.body ?? '' })
      expect(result).toMatchObject({ pushed: true, compareUrl: expect.stringContaining('/compare/') })
      expect('pr' in result && result.pr !== undefined).toBe(gh)
    }
  })

  test('a failing push is the reason, not a throw', async () => {
    const { session, ports } = await setup()
    await edit(session, 'MAX_MOVE_SPEED = 400.0\n')
    if (ports.changeSet !== undefined) ports.changeSet.ship = () => Promise.reject(new Error('no remote'))
    expect(await session.ship({ title: 'Faster', body: '' })).toEqual({ error: 'no remote' })
  })

  test('export, change, plan and apply: one Import step that Undo takes back (EDS-o)', async () => {
    const { session, ports } = await setup()
    const text = await session.exportGame('toml')
    expect(text).toContain('MAX_MOVE_SPEED = 356')
    const plan = await session.planImport(text.replace('MAX_MOVE_SPEED = 356', 'MAX_MOVE_SPEED = 400'))
    expect(plan).toMatchObject({ applicable: true, changes: [{ path: TUNING }] })
    const applying = session.applyImport(plan)
    await new Promise((resolve) => setTimeout(resolve, 0))
    session.answerTitle('Import speed')
    expect(await applying).toMatchObject({ written: true })
    expect((await ports.workspace.read(TUNING))?.text).toBe('MAX_MOVE_SPEED = 400.0\n')
    expect(session.writePath.undoLabel()).toBe('Import')
  })

  test('an import plan without an editor list is an error', async () => {
    const memory = await createMemoryPorts({
      files: { [TUNING]: 'a = 1\n' },
      classify: (path) => ({ path, writable: false, why: 'no list' }),
    })
    const session = createSuiteSession(memory.ports, { installed: [] })
    expect(await session.planImport('{}')).toMatchObject({ error: expect.stringContaining(EDITOR_LIST_PATH) })
  })
})
