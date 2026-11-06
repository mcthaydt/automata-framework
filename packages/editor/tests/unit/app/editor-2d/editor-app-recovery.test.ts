import { describe, expect, it } from 'vitest'
import type { Recovery } from '#src/shared/kit/storage/recovery.ts'
import { createEditorApp, type OpenDocument } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import { memoryWorkspace, textOf } from '#src/testing/level-2d/memory-workspace.ts'
import { type Note, noteText, plantedProfile, savedCount } from '#src/testing/level-2d/planted-profile.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'

// Opening offers an autosave and restoring applies it.

function setup() {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createProfileRegistry()
  registry.register(plantedProfile())
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  return { app, workspace, clock }
}

type Setup = ReturnType<typeof setup>

/** Opens `a.note`, edits it and lets the autosave write its journal, then drops the document the way a closed tab does. */
async function leaveAutosave({ app, workspace, clock }: Setup, text = 'edited'): Promise<void> {
  await workspace.store.write('a.note', noteText('hello', 4))
  clock.advance(1000)
  const outcome = await app.open('a.note')
  if (outcome.status !== 'opened') throw new Error(outcome.status)
  outcome.document.history.apply('Edit', () => ({ text }))
  clock.advance(1000)
  await outcome.document.session.flush()
  outcome.document.dispose()
}

async function reopened(s: Setup): Promise<{ document: OpenDocument; recovery: Recovery }> {
  const outcome = await s.app.open('a.note')
  if (outcome.status !== 'opened' || outcome.recovery === undefined) throw new Error('no recovery offered')
  return { document: outcome.document, recovery: outcome.recovery }
}

describe('recovery', () => {
  it('offers the autosave that is newer than the file, and applies nothing yet', async () => {
    const s = setup()
    await leaveAutosave(s)
    const outcome = await s.app.open('a.note')
    expect(outcome.status).toBe('opened')
    if (outcome.status !== 'opened') return
    expect(outcome.recovery).toMatchObject({ baseChanged: false })
    expect(outcome.recovery?.payload).toBe(noteText('edited', 5))
    expect(outcome.document.history.state).toEqual({ text: 'hello' })
    expect(outcome.document.session.status).toBe('saved')
  })

  it('offers nothing when no autosave was written', async () => {
    const s = setup()
    await s.workspace.store.write('a.note', noteText('hello'))
    const outcome = await s.app.open('a.note')
    expect(outcome).toMatchObject({ status: 'opened', recovery: undefined })
  })

  it('restores the autosave as one undoable step that leaves the document dirty', async () => {
    const s = setup()
    await leaveAutosave(s)
    const { document, recovery } = await reopened(s)
    expect(document.restore(recovery)).toEqual({ ok: true, value: true })
    expect(document.history.state).toEqual({ text: 'edited' })
    expect(document.history.undoLabel).toBe('Restore autosave')
    expect(document.session.status).toBe('dirty')
    document.history.undo()
    expect(document.history.state).toEqual({ text: 'hello' })
  })

  it('prints the next save against the restored text', async () => {
    const s = setup()
    await leaveAutosave(s)
    const { document, recovery } = await reopened(s)
    document.restore(recovery)
    await document.save()
    // The autosave was saved 5; the file was saved 4. A save after a restore continues from the text restored.
    expect(savedCount(textOf(await s.workspace.store.read('a.note')) ?? '')).toBe(6)
  })

  it('refuses a payload that no longer parses, and changes nothing', async () => {
    const s = setup()
    await leaveAutosave(s)
    const { document, recovery } = await reopened(s)
    const result = document.restore({ ...recovery, payload: 'not a note' })
    expect(result).toMatchObject({ ok: false, error: [{ code: 'notNote' }] })
    expect(document.history.state).toEqual({ text: 'hello' })
    expect(document.history.canUndo).toBe(false)
    expect(document.session.status).toBe('saved')
  })

  it('discards the autosave, and a later open offers none', async () => {
    const s = setup()
    await leaveAutosave(s)
    const { document } = await reopened(s)
    await document.discardRecovery()
    expect(await s.workspace.journal.list()).toEqual([])
    document.dispose()
    expect(await s.app.open('a.note')).toMatchObject({ status: 'opened', recovery: undefined })
  })

  it('does not offer an autosave older than the file', async () => {
    const s = setup()
    await leaveAutosave(s)
    s.clock.advance(5000)
    await s.workspace.store.write('a.note', noteText('saved by hand', 7))
    expect(await s.app.open('a.note')).toMatchObject({ status: 'opened', recovery: undefined })
  })

  it('opens the document anyway, and says why, when the autosave cannot be read', async () => {
    const s = setup()
    await s.workspace.store.write('a.note', noteText('hello'))
    const broken = { ...s.workspace.journal, read: () => Promise.reject(new Error('journal unavailable')) }
    const app = createEditorApp({
      workspace: { ...s.workspace, journal: broken },
      registry: s.app.registry,
      ids: counterIds(),
      clock: s.clock,
    })
    const outcome = await app.open('a.note')
    expect(outcome).toMatchObject({
      status: 'opened',
      recovery: undefined,
      recoveryError: 'journal unavailable',
    })
    if (outcome.status === 'opened')
      expect(outcome.document.history.state).toEqual({ text: 'hello' } satisfies Note)
  })
})
