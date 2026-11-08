// The Ask controller (ED3D.10a steps 4 and 5, spec §5.3 flow 8 and ED3-j): a prompt goes to the provider with the
// selection and a budget, the proposal is read into a copy of the level and shown as a ghost with its check results,
// and Accept applies it as one step unless the copy has errors. The provider is a script the test settles itself.

import type { AfSector } from '@automata/3d/level'
import type { Proposal } from '@automata/editor/kit/ports'
import { createScriptedAsk } from '@automata/editor/kit/ports/testing'
import { describe, expect, it, vi } from 'vitest'
import { createAsk } from '#src/app/ask-controller.ts'
import type { CheckResult } from '#src/shared/checks/check.ts'
import { ok } from '#src/shared/edit/edit.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { GeometryError, type LevelProfile } from '#src/shared/level-session/level-profile.ts'
import type { EditSector } from '#src/shared/level-session/sector-access.ts'
import { deferred } from '#src/testing/fake-ask.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

/** The depot with its sectors changed by `change`. */
const withSectors = (change: (sectors: readonly EditSector[]) => readonly EditSector[]): AfSector =>
  afSectorProfile.sectors.withSectors(depot, change(afSectorProfile.sectors.list(depot)))

const withHall = (change: Partial<EditSector>): AfSector =>
  withSectors((sectors) =>
    sectors.map((sector) => (sector.id === 'hall' ? { ...sector, ...change } : sector)),
  )

const annex: EditSector = {
  id: 'annex',
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [20, 0],
    [24, 0],
    [24, 4],
    [20, 4],
  ],
}

const proposalOf = (level: unknown, more: Partial<Proposal> = {}): Proposal => ({
  summary: 'Raise the hall',
  text: JSON.stringify(level),
  tokens: 120,
  ...more,
})

const raised = proposalOf(withHall({ ceiling: 5 }))
const BUDGET = 4000
const PATH = 'content/levels/depot.af3d.json'

function setup(
  answer: (call: { prompt: string }) => Promise<Proposal> | Proposal = () => raised,
  profile: LevelProfile<AfSector> = afSectorProfile,
) {
  const editor = createLevelEditor({ profile, level: depot })
  const provider = createScriptedAsk(answer)
  const ask = createAsk(editor, { provider: provider.provider, budget: BUDGET, path: PATH })
  return { editor, provider, ask }
}

const result = (id: string, severity: 'error' | 'warning', messages: string[]): CheckResult => ({
  id,
  ok: messages.length === 0,
  severity,
  detail: messages.join('; ') || 'ok',
  problems: messages.map((message) => ({ message })),
})

describe('without a provider', () => {
  it('is off: nothing is available, and asking does nothing', async () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
    const ask = createAsk(editor, { budget: BUDGET, path: PATH })
    const told = vi.fn()
    ask.subscribe(told)
    expect(ask.view).toEqual({
      available: false,
      status: 'idle',
      prompt: undefined,
      ghost: undefined,
      message: undefined,
    })
    await ask.ask('Raise the hall')
    expect(ask.view.status).toBe('idle')
    expect(told).not.toHaveBeenCalled()
  })
})

describe('asking', () => {
  it('starts idle and available', () => {
    const { ask } = setup()
    expect(ask.view).toEqual({
      available: true,
      status: 'idle',
      prompt: undefined,
      ghost: undefined,
      message: undefined,
    })
  })

  it('is asking at once, with the prompt, and has a ghost when the proposal comes', async () => {
    const later = deferred<Proposal>()
    const { ask } = setup(() => later.promise)
    const told = vi.fn()
    ask.subscribe(told)
    const asked = ask.ask('  Raise the hall  ')
    expect(ask.view).toMatchObject({ status: 'asking', prompt: 'Raise the hall', ghost: undefined })
    expect(told).toHaveBeenCalledTimes(1)
    later.resolve(raised)
    await asked
    expect(ask.view).toMatchObject({ status: 'ghost', prompt: 'Raise the hall', message: undefined })
    expect(told).toHaveBeenCalledTimes(2)
  })

  it("gives the provider the trimmed prompt, the level's path, the selection as it was, the budget and the live level as JSON", async () => {
    const { editor, provider, ask } = setup()
    editor.selection.set(['sector:hall', 'wall:hall/1'])
    await ask.ask('  Raise the hall ')
    expect(provider.calls).toEqual([
      {
        prompt: 'Raise the hall',
        path: PATH,
        scope: ['sector:hall', 'wall:hall/1'],
        budget: BUDGET,
        document: JSON.stringify(depot, null, 2),
      },
    ])
  })

  it("shows the proposal's level, its checks, its geometry and what it changed", async () => {
    const { ask } = setup()
    await ask.ask('Raise the hall')
    const ghost = ask.view.ghost
    const level = withHall({ ceiling: 5 })
    expect(ghost).toMatchObject({
      summary: 'Raise the hall',
      tokens: 120,
      level,
      sectors: { added: [], changed: ['hall'], removed: [] },
      errors: 0,
      warnings: 0,
      canAccept: true,
    })
    expect(ghost?.checks).toEqual(afSectorProfile.checks(level))
    expect(ghost?.geometry).toEqual(afSectorProfile.geometry(level))
  })

  it('tells the sectors added, changed and removed apart', async () => {
    const moved = withSectors((sectors) =>
      sectors.map((sector) =>
        sector.id === 'dock'
          ? {
              ...sector,
              corners: [
                [8, 0],
                [16, 0],
                [16, 6],
                [8, 6, { next: 'hall' }],
              ],
            }
          : sector,
      ),
    )
    const added = withSectors((sectors) => [...sectors, annex])
    const dropped = withSectors((sectors) => sectors.filter((sector) => sector.id !== 'dock'))
    const both = withSectors((sectors) => [...sectors.filter((sector) => sector.id !== 'dock'), annex])
    const delta: [AfSector, object][] = [
      [moved, { added: [], changed: ['dock'], removed: [] }],
      [added, { added: ['annex'], changed: [], removed: [] }],
      [dropped, { added: [], changed: [], removed: ['dock'] }],
      [both, { added: ['annex'], changed: [], removed: ['dock'] }],
    ]
    for (const [level, expected] of delta) {
      const { ask } = setup(() => proposalOf(level))
      await ask.ask('Change the depot')
      expect(ask.view.ghost?.sectors).toEqual(expected)
    }
  })

  it('cannot be accepted when the proposal leaves check errors, and says how many', async () => {
    const { ask } = setup(() => proposalOf(withHall({ ceiling: -1 })))
    await ask.ask('Lower the hall')
    expect(ask.view.ghost).toMatchObject({ errors: 2, warnings: 0, canAccept: false })
  })

  it('can be accepted with only warnings', async () => {
    const scripted: LevelProfile<AfSector> = {
      ...afSectorProfile,
      checks: () => [result('policy', 'warning', ['no group for annex'])],
    }
    const { ask } = setup(() => proposalOf(withHall({ ceiling: 5 })), scripted)
    await ask.ask('Raise the hall')
    expect(ask.view.ghost).toMatchObject({ errors: 0, warnings: 1, canAccept: true })
  })

  it('has no geometry for a proposal the profile cannot build, and still a ghost', async () => {
    const strict: LevelProfile<AfSector> = {
      ...afSectorProfile,
      geometry: (level) => {
        if (level !== depot) throw new GeometryError('the annex has no walls')
        return afSectorProfile.geometry(level)
      },
    }
    const { ask } = setup(() => proposalOf(withSectors((sectors) => [...sectors, annex])), strict)
    await ask.ask('Add an annex')
    expect(ask.view.status).toBe('ghost')
    expect(ask.view.ghost?.geometry).toBeUndefined()
  })

  it('does not call the provider twice while one request is out', async () => {
    const later = deferred<Proposal>()
    const { provider, ask } = setup(() => later.promise)
    const first = ask.ask('Raise the hall')
    await ask.ask('Raise it more')
    expect(provider.calls).toHaveLength(1)
    expect(ask.view.prompt).toBe('Raise the hall')
    later.resolve(raised)
    await first
    expect(ask.view.status).toBe('ghost')
  })

  it('asks again over a ghost and replaces it', async () => {
    const answers = [raised, proposalOf(withHall({ light: 0.5 }), { summary: 'Dim the hall' })]
    const { provider, ask } = setup(() => answers.shift() as Proposal)
    await ask.ask('Raise the hall')
    await ask.ask('Dim the hall')
    expect(provider.calls).toHaveLength(2)
    expect(ask.view.ghost?.summary).toBe('Dim the hall')
  })
})

describe('an ask that ends with nothing to show', () => {
  const failed = (message: string) => ({ status: 'failed', ghost: undefined, message })

  it('is refused for an empty prompt without calling the provider', async () => {
    const { provider, ask } = setup()
    await ask.ask('   ')
    expect(provider.calls).toHaveLength(0)
    expect(ask.view).toMatchObject(failed('say what you want changed'))
  })

  it('says the assistant failed, whatever it threw or rejected with', async () => {
    const rejecting = setup(() => Promise.reject(new Error('the key is wrong')))
    await rejecting.ask.ask('Raise the hall')
    expect(rejecting.ask.view).toMatchObject(failed('the assistant failed: the key is wrong'))
    const text = setup(() => Promise.reject('rate limited'))
    await text.ask.ask('Raise the hall')
    expect(text.ask.view).toMatchObject(failed('the assistant failed: rate limited'))
    const throwing = setup(() => {
      throw new Error('no network')
    })
    await throwing.ask.ask('Raise the hall')
    expect(throwing.ask.view).toMatchObject(failed('the assistant failed: no network'))
  })

  it('names the numbers when the proposal used more tokens than the budget', async () => {
    const { ask } = setup(() => ({ ...raised, tokens: BUDGET + 1 }))
    await ask.ask('Raise the hall')
    expect(ask.view).toMatchObject(failed('the proposal used 4001 tokens, over the budget of 4000'))
    const exact = setup(() => ({ ...raised, tokens: BUDGET }))
    await exact.ask.ask('Raise the hall')
    expect(exact.ask.view.status).toBe('ghost')
  })

  it("gives the codec's first issue for a proposal that is not a level", async () => {
    const notJson = setup(() => ({ ...raised, text: '{ "sectors": ' }))
    await notJson.ask.ask('Raise the hall')
    const refused = afSectorProfile.parse('{ "sectors": ')
    expect(refused.ok).toBe(false)
    expect(notJson.ask.view.message).toBe(
      `the proposal is not a level this editor can read: ${refused.ok ? '' : refused.issues[0]?.message}`,
    )
    const noId = setup(() => proposalOf({ ...depot, sectors: [{ floor: 0 }] }))
    await noId.ask.ask('Raise the hall')
    expect(noId.ask.view.message).toMatch(
      /^the proposal is not a level this editor can read: sectors\/0\/id: /,
    )
    expect(noId.ask.view.status).toBe('failed')
  })

  it('says so when the proposal is the level as it stands', async () => {
    const { ask } = setup(() => proposalOf(depot))
    await ask.ask('Do nothing')
    expect(ask.view).toMatchObject(failed('the proposal changes nothing'))
  })

  it('keeps the prompt that failed in the view', async () => {
    const { ask } = setup(() => Promise.reject(new Error('boom')))
    await ask.ask('Raise the hall')
    expect(ask.view.prompt).toBe('Raise the hall')
  })
})

/** What a subscriber sees: the status after each change. */
function statuses(ask: ReturnType<typeof setup>['ask']): string[] {
  const seen: string[] = []
  ask.subscribe(() => seen.push(ask.view.status))
  return seen
}

/** An edit of the hall's light: the level changes under a ghost. */
const dimHall = {
  id: 'test.dim',
  label: 'Dim the hall',
  run: (profile: LevelProfile<AfSector>, level: AfSector) =>
    ok(
      profile.sectors.withSectors(
        level,
        profile.sectors
          .list(level)
          .map((sector) => (sector.id === 'hall' ? { ...sector, light: 0.4 } : sector)),
      ),
    ),
}

describe('accept', () => {
  it('applies the proposal as one undo step labelled by its summary, and the ghost is gone', async () => {
    const { editor, ask } = setup()
    editor.selection.set(['sector:hall'])
    await ask.ask('Raise the hall')
    const seen = statuses(ask)
    expect(ask.accept()).toEqual({ ok: true })
    expect(editor.level).toEqual(withHall({ ceiling: 5 }))
    expect(editor.history.undoLabel).toBe('Ask: Raise the hall')
    expect(ask.view).toMatchObject({
      status: 'idle',
      prompt: undefined,
      ghost: undefined,
      message: undefined,
    })
    // The change of the level that Accept itself makes does not read as a level that moved under the ghost.
    expect(seen).toEqual(['idle'])
    expect(editor.selection.ids).toEqual(['sector:hall'])
    editor.history.undo()
    expect(editor.level).toBe(depot)
    expect(editor.history.canUndo).toBe(false)
    // Nor does the level moving on afterwards (a redo, an edit) read as one.
    editor.history.redo()
    editor.run(dimHall)
    expect(seen).toEqual(['idle'])
  })

  it('refuses a proposal that leaves check errors with the first one, and keeps the ghost', async () => {
    const { editor, ask } = setup(() => proposalOf(withHall({ ceiling: -1 })))
    await ask.ask('Lower the hall')
    expect(ask.accept()).toEqual({
      ok: false,
      reason: 'the proposal leaves 2 check errors: hall: the ceiling (-1 m) is not above the floor (0 m)',
    })
    expect(editor.level).toBe(depot)
    expect(ask.view.status).toBe('ghost')
  })

  it('says error in the singular for one', async () => {
    const scripted: LevelProfile<AfSector> = {
      ...afSectorProfile,
      checks: () => [result('heights', 'error', ['too low']), result('policy', 'warning', ['no group'])],
    }
    const { ask } = setup(undefined, scripted)
    await ask.ask('Raise the hall')
    expect(ask.accept()).toEqual({ ok: false, reason: 'the proposal leaves 1 check error: too low' })
  })

  it('refuses when there is nothing to accept', async () => {
    const { ask } = setup()
    expect(ask.accept()).toEqual({ ok: false, reason: 'there is no proposal to accept' })
    await ask.ask('  ')
    expect(ask.accept()).toEqual({ ok: false, reason: 'there is no proposal to accept' })
  })

  it("refuses with the history's own sentence while another step is open, and works once it is over", async () => {
    const { editor, ask } = setup()
    await ask.ask('Raise the hall')
    const drag = editor.begin('Drag')
    expect(ask.accept()).toEqual({
      ok: false,
      reason: 'cannot apply "Ask: Raise the hall" inside the open transaction "Drag"',
    })
    expect(ask.view.status).toBe('ghost')
    expect(editor.level).toBe(depot)
    drag.cancel()
    expect(ask.accept()).toEqual({ ok: true })
    expect(editor.level).toEqual(withHall({ ceiling: 5 }))
  })
})

describe('reject', () => {
  it('drops a ghost and dismisses a failure', async () => {
    const { editor, ask } = setup()
    await ask.ask('Raise the hall')
    const seen = statuses(ask)
    ask.reject()
    expect(ask.view).toMatchObject({
      status: 'idle',
      prompt: undefined,
      ghost: undefined,
      message: undefined,
    })
    expect(editor.level).toBe(depot)
    // The ghost it dropped is not followed any more.
    editor.run(dimHall)
    expect(seen).toEqual(['idle'])
    await ask.ask('  ')
    expect(ask.view.status).toBe('failed')
    ask.reject()
    expect(ask.view).toMatchObject({ status: 'idle', prompt: undefined, message: undefined })
  })

  it('tells nobody when there is nothing to drop', () => {
    const { ask } = setup()
    const told = vi.fn()
    ask.subscribe(told)
    ask.reject()
    expect(told).not.toHaveBeenCalled()
  })

  it('stops waiting for a proposal, and ignores it when it comes', async () => {
    const later = deferred<Proposal>()
    const { ask } = setup(() => later.promise)
    const asked = ask.ask('Raise the hall')
    const seen = statuses(ask)
    ask.reject()
    expect(ask.view.status).toBe('idle')
    later.resolve(raised)
    await asked
    expect(ask.view).toMatchObject({ status: 'idle', ghost: undefined })
    expect(seen).toEqual(['idle'])
  })

  it('ignores the failure of a request it gave up on', async () => {
    const later = deferred<Proposal>()
    const { ask } = setup(() => later.promise)
    const asked = ask.ask('Raise the hall')
    ask.reject()
    later.reject(new Error('too late'))
    await asked
    expect(ask.view.status).toBe('idle')
  })

  it('lets a new ask through, whose answer is the one that counts', async () => {
    const first = deferred<Proposal>()
    const second = deferred<Proposal>()
    const later = [first, second]
    const { ask } = setup(() => (later.shift() as ReturnType<typeof deferred<Proposal>>).promise)
    const gaveUp = ask.ask('Raise the hall')
    ask.reject()
    const again = ask.ask('Dim the hall')
    first.resolve(raised)
    await gaveUp
    expect(ask.view).toMatchObject({ status: 'asking', prompt: 'Dim the hall' })
    second.resolve(proposalOf(withHall({ light: 0.5 }), { summary: 'Dim the hall' }))
    await again
    expect(ask.view.ghost?.summary).toBe('Dim the hall')
  })
})

describe('a ghost the level has left behind', () => {
  const gone = {
    status: 'failed',
    prompt: 'Raise the hall',
    ghost: undefined,
    message: 'the level changed, so the proposal no longer applies; ask again',
  }

  it('is dropped by an edit, an undo and a redo', async () => {
    const edited = setup()
    await edited.ask.ask('Raise the hall')
    const seen = statuses(edited.ask)
    edited.editor.run(dimHall)
    expect(edited.ask.view).toMatchObject(gone)
    // It is told once: the level coming back to where it was (an undo, then a redo) is not a second ghost dropped.
    edited.editor.history.undo()
    edited.editor.history.redo()
    expect(seen).toEqual(['failed'])

    const undone = setup()
    undone.editor.run(dimHall)
    await undone.ask.ask('Raise the hall')
    expect(undone.ask.view.status).toBe('ghost')
    undone.editor.history.undo()
    expect(undone.ask.view).toMatchObject(gone)

    const redone = setup()
    redone.editor.run(dimHall)
    redone.editor.history.undo()
    await redone.ask.ask('Raise the hall')
    redone.editor.history.redo()
    expect(redone.ask.view).toMatchObject(gone)
  })

  it('is dropped by the first live run of a drag', async () => {
    const { editor, ask } = setup()
    await ask.ask('Raise the hall')
    const drag = editor.begin('Drag')
    expect(ask.view.status).toBe('ghost')
    drag.run(dimHall)
    expect(ask.view).toMatchObject(gone)
  })

  it('stays through what is not a change of the level: a selection, the view, a step that changes nothing', async () => {
    const { editor, ask } = setup()
    await ask.ask('Raise the hall')
    editor.selection.set(['sector:dock'])
    editor.view.set({ camera: { x: 3, z: 3, zoom: 2 } })
    editor.run({ id: 'test.nothing', label: 'Nothing', run: (_, level) => ok(level) })
    expect(ask.view.status).toBe('ghost')
  })

  it('is dropped when the proposal comes after the level moved, without ever showing', async () => {
    const later = deferred<Proposal>()
    const { editor, ask } = setup(() => later.promise)
    const asked = ask.ask('Raise the hall')
    const seen = statuses(ask)
    editor.run(dimHall)
    expect(ask.view.status).toBe('asking')
    later.resolve(raised)
    await asked
    expect(ask.view).toMatchObject(gone)
    expect(seen).toEqual(['failed'])
  })
})

describe('a second request and a second ghost', () => {
  it('is not failed early by an edit while its proposal is on its way', async () => {
    const later = deferred<Proposal>()
    const answers = [Promise.resolve(raised), later.promise]
    const { editor, ask } = setup(() => answers.shift() as Promise<Proposal>)
    await ask.ask('Raise the hall')
    const asked = ask.ask('Raise it again')
    editor.run(dimHall)
    expect(ask.view).toMatchObject({ status: 'asking', prompt: 'Raise it again' })
    later.resolve(raised)
    await asked
    expect(ask.view.status).toBe('failed')
  })

  it('is followed after Accept as the first was', async () => {
    const answers = [raised, proposalOf(withHall({ ceiling: 6 }), { summary: 'Raise it more' })]
    const { editor, ask } = setup(() => answers.shift() as Proposal)
    await ask.ask('Raise the hall')
    ask.accept()
    await ask.ask('Raise it more')
    expect(ask.view.status).toBe('ghost')
    editor.run(dimHall)
    expect(ask.view.status).toBe('failed')
  })
})

describe('dispose', () => {
  it('stops following the editor and tells nobody after', async () => {
    const { editor, ask } = setup()
    await ask.ask('Raise the hall')
    const told = vi.fn()
    ask.subscribe(told)
    ask.dispose()
    editor.run(dimHall)
    expect(told).not.toHaveBeenCalled()
    expect(ask.view.status).toBe('ghost')
  })

  it('ignores a proposal that arrives later', async () => {
    const later = deferred<Proposal>()
    const { ask } = setup(() => later.promise)
    const asked = ask.ask('Raise the hall')
    ask.dispose()
    later.resolve(raised)
    await asked
    expect(ask.view.status).toBe('asking')
  })
})
