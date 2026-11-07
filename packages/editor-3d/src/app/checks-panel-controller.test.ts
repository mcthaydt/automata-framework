// The checks panel (ED3D.10a steps 2 and 3, spec §5.3 flow 7): when the checks run, what the pill counts, and what
// Locate does with a problem. The timer is a fake that the test fires, so nothing here waits.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it, vi } from 'vitest'
import type { CheckResult } from '../checks/check'
import type { Edit } from '../model/edit'
import { ok } from '../model/edit'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { LevelProfile } from '../profile/level-profile'
import type { EditSector } from '../profile/sector-access'
import { loadAuthored } from '../testing/fixtures'
import { createChecksPanel, type Scheduler } from './checks-panel-controller'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

/** Changes the hall; with a ceiling below its floor the `heights` check fails twice (the room, and the portal beside it). */
const setHall = (change: Partial<EditSector>): Edit<AfSector> => ({
  id: 'test.hall',
  label: 'Change the hall',
  run: (profile, level) =>
    ok(
      profile.sectors.withSectors(
        level,
        profile.sectors
          .list(level)
          .map((sector) => (sector.id === 'hall' ? { ...sector, ...change } : sector)),
      ),
    ),
})

const breakHall = setHall({ ceiling: -1 })
const mendHall = setHall({ ceiling: 4 })
/** An edit that leaves the level as it was: the history records nothing. */
const nothing: Edit<AfSector> = { id: 'test.nothing', label: 'Nothing', run: (_, level) => ok(level) }

/** A timer that keeps its calls and runs the live ones on `flush`. */
function fakeScheduler() {
  const calls: { readonly delayMs: number; readonly run: () => void; live: boolean }[] = []
  const schedule: Scheduler = (delayMs, run) => {
    const call = { delayMs, run, live: true }
    calls.push(call)
    return () => {
      call.live = false
    }
  }
  return {
    schedule,
    calls,
    get waiting() {
      return calls.filter((call) => call.live)
    },
    flush() {
      for (const call of calls.filter((each) => each.live)) {
        call.live = false
        call.run()
      }
    },
  }
}

/** The depot's profile with its checks watched. */
function watched(profile: LevelProfile<AfSector> = afSectorProfile) {
  const checks = vi.fn(profile.checks)
  return { profile: { ...profile, checks } as LevelProfile<AfSector>, checks }
}

function setup(options: { delayMs?: number; profile?: LevelProfile<AfSector>; level?: AfSector } = {}) {
  const editor = createLevelEditor({
    profile: options.profile ?? afSectorProfile,
    level: options.level ?? depot,
  })
  const timer = fakeScheduler()
  const panel = createChecksPanel(editor, {
    schedule: timer.schedule,
    ...(options.delayMs === undefined ? {} : { delayMs: options.delayMs }),
  })
  return { editor, timer, panel }
}

const result = (id: string, severity: 'error' | 'warning', messages: string[]): CheckResult => ({
  id,
  ok: messages.length === 0,
  severity,
  detail: messages.join('; ') || 'ok',
  problems: messages.map((message) => ({ message })),
})

describe('the panel when it is made', () => {
  it("holds the profile's own results for the level, nothing pending and nothing wrong", () => {
    const { panel } = setup()
    expect(panel.view.results).toEqual(afSectorProfile.checks(depot))
    expect(panel.view).toMatchObject({ errors: 0, warnings: 0, pending: false })
  })

  it('counts the problems of a level that is already broken', () => {
    const broken = afSectorProfile.sectors.withSectors(
      depot,
      afSectorProfile.sectors
        .list(depot)
        .map((sector) => (sector.id === 'hall' ? { ...sector, ceiling: -1 } : sector)),
    )
    const { panel } = setup({ level: broken })
    expect(panel.view).toMatchObject({ errors: 2, warnings: 0, pending: false })
  })
})

describe('a committed step', () => {
  it('asks for one run after the pause and leaves the pill on the earlier step until it comes', () => {
    const { editor, timer, panel } = setup()
    editor.run(breakHall)
    expect(timer.waiting).toHaveLength(1)
    expect(timer.waiting[0]?.delayMs).toBe(250)
    expect(panel.view).toMatchObject({ errors: 0, pending: true })
    timer.flush()
    expect(panel.view).toMatchObject({ errors: 2, pending: false })
    expect(panel.view.results).toEqual(afSectorProfile.checks(editor.level))
  })

  it('takes the pause from the option', () => {
    const { editor, timer } = setup({ delayMs: 40 })
    editor.run(breakHall)
    expect(timer.waiting[0]?.delayMs).toBe(40)
  })

  it('restarts the pause when another step comes before it ends, and runs once, on the latest level', () => {
    const { profile, checks } = watched()
    const { editor, timer, panel } = setup({ profile })
    checks.mockClear()
    editor.run(breakHall)
    const first = timer.waiting[0]
    editor.run(mendHall)
    expect(first?.live).toBe(false)
    expect(timer.waiting).toHaveLength(1)
    timer.flush()
    expect(checks).toHaveBeenCalledTimes(1)
    expect(panel.view).toMatchObject({ errors: 0, pending: false })
  })

  it("is not asked for by a session's live runs: a drag shows no pill until it commits", () => {
    const { editor, timer, panel } = setup()
    const drag = editor.begin('Drag')
    drag.run(breakHall)
    expect(timer.calls).toHaveLength(0)
    expect(panel.view.pending).toBe(false)
    drag.commit()
    expect(timer.waiting).toHaveLength(1)
    timer.flush()
    expect(panel.view.errors).toBe(2)
  })

  it("is not asked for by a session's live runs after an earlier step either", () => {
    const { editor, timer } = setup()
    editor.run(breakHall)
    timer.flush()
    const drag = editor.begin('Drag')
    drag.run(mendHall)
    expect(timer.waiting).toHaveLength(0)
    drag.commit()
    expect(timer.waiting).toHaveLength(1)
  })

  it('is not asked for by a session that is cancelled', () => {
    const { editor, timer, panel } = setup()
    const drag = editor.begin('Drag')
    drag.run(breakHall)
    drag.cancel()
    expect(timer.calls).toHaveLength(0)
    expect(panel.view).toMatchObject({ errors: 0, pending: false })
  })

  it('is asked for by an undo and a redo', () => {
    const { editor, timer, panel } = setup()
    editor.run(breakHall)
    timer.flush()
    editor.history.undo()
    expect(timer.waiting).toHaveLength(1)
    timer.flush()
    expect(panel.view.errors).toBe(0)
    editor.history.redo()
    expect(timer.waiting).toHaveLength(1)
    timer.flush()
    expect(panel.view.errors).toBe(2)
  })

  it('is not asked for by a step that leaves the level as it was', () => {
    const { editor, timer } = setup()
    editor.run(nothing)
    expect(timer.calls).toHaveLength(0)
  })
})

describe('run', () => {
  it('runs now, drops the call that was waiting and clears the pending flag', () => {
    const { editor, timer, panel } = setup()
    editor.run(breakHall)
    panel.run()
    expect(timer.waiting).toHaveLength(0)
    expect(panel.view).toMatchObject({ errors: 2, pending: false })
  })

  it("reads the level as last committed, not a session's live one", () => {
    const { editor, panel } = setup()
    const drag = editor.begin('Drag')
    drag.run(breakHall)
    panel.run()
    expect(panel.view.errors).toBe(0)
    drag.commit()
    panel.run()
    expect(panel.view.errors).toBe(2)
  })
})

describe('the counts', () => {
  const scripted: LevelProfile<AfSector> = {
    ...afSectorProfile,
    checks: () => [
      result('ids', 'error', []),
      result('heights', 'error', ['one', 'two', 'three']),
      result('policy', 'warning', ['four', 'five']),
      result('lamps', 'warning', []),
    ],
  }

  it('count problems, errors and warnings apart, and a passing check counts nothing', () => {
    const { panel } = setup({ profile: scripted })
    expect(panel.view).toMatchObject({ errors: 3, warnings: 2 })
    expect(panel.view.results).toHaveLength(4)
  })
})

describe('subscribers', () => {
  it('are told when the pill goes pending and when the results come, and not when nothing changed', () => {
    const { editor, timer, panel } = setup()
    const told = vi.fn()
    panel.subscribe(told)
    editor.run(breakHall)
    expect(told).toHaveBeenCalledTimes(1)
    editor.run(mendHall)
    expect(told).toHaveBeenCalledTimes(1)
    timer.flush()
    expect(told).toHaveBeenCalledTimes(2)
  })

  it('are not told, and the view stays the same object, by a run that finds what was already there', () => {
    const { panel } = setup()
    const told = vi.fn()
    panel.subscribe(told)
    const before = panel.view
    panel.run()
    expect(told).not.toHaveBeenCalled()
    expect(panel.view).toBe(before)
  })

  it('stop being told after they unsubscribe', () => {
    const { editor, panel } = setup()
    const told = vi.fn()
    const stop = panel.subscribe(told)
    stop()
    editor.run(breakHall)
    expect(told).not.toHaveBeenCalled()
  })
})

describe('dispose', () => {
  it('cancels the waiting call, stops following the editor and tells nobody after', () => {
    const { editor, timer, panel } = setup()
    const told = vi.fn()
    panel.subscribe(told)
    editor.run(breakHall)
    told.mockClear()
    panel.dispose()
    expect(timer.waiting).toHaveLength(0)
    editor.run(mendHall)
    expect(timer.calls).toHaveLength(1)
    expect(told).not.toHaveBeenCalled()
  })

  it('ignores a timer that fires anyway', () => {
    const { editor, timer, panel } = setup()
    editor.run(breakHall)
    const call = timer.calls[0]
    panel.dispose()
    call?.run()
    expect(panel.view.errors).toBe(0)
  })
})

describe('locate', () => {
  /** The camera is somewhere else and zoomed, in the dollhouse, so a locate has something to leave alone. */
  function located() {
    const made = setup()
    made.editor.view.set({ camera: { x: 20, z: 20, zoom: 2 }, mode: 'dollhouse', layer: 'walls' })
    return made
  }

  it('selects a sector and centres the plan on the middle of its corners, keeping zoom, mode and layer', () => {
    const { editor, panel } = located()
    expect(panel.locate({ selection: 'sector:hall' })).toEqual({ ok: true })
    expect(editor.selection.ids).toEqual(['sector:hall'])
    expect(editor.view.state).toMatchObject({
      camera: { x: 4, z: 3, zoom: 2 },
      mode: 'dollhouse',
      layer: 'walls',
    })
  })

  it('replaces the selection it found', () => {
    const { editor, panel } = located()
    editor.selection.set(['sector:dock', 'sector:hall'])
    panel.locate({ selection: 'sector:dock' })
    expect(editor.selection.ids).toEqual(['sector:dock'])
    expect(editor.view.state.camera).toMatchObject({ x: 11, z: 3 })
  })

  it('centres on the middle of a wall, the last wall of an outline closing on the first corner', () => {
    const { editor, panel } = located()
    panel.locate({ selection: 'wall:hall/1' })
    expect(editor.view.state.camera).toMatchObject({ x: 8, z: 3, zoom: 2 })
    panel.locate({ selection: 'wall:hall/3' })
    expect(editor.selection.ids).toEqual(['wall:hall/3'])
    expect(editor.view.state.camera).toMatchObject({ x: 0, z: 3 })
  })

  it("centres on a locator's point rather than the middle of what it names", () => {
    const { editor, panel } = located()
    panel.locate({ selection: 'wall:hall/1', at: { x: 8, z: 0 } })
    expect(editor.view.state.camera).toMatchObject({ x: 8, z: 0 })
    panel.locate({ selection: 'sector:hall', at: { x: 1, z: 2 } })
    expect(editor.view.state.camera).toMatchObject({ x: 1, z: 2 })
  })

  it('selects an entity, and frames it only when the locator carries a point', () => {
    const { editor, panel } = located()
    expect(panel.locate({ selection: 'entity:crate/crate1' })).toEqual({ ok: true })
    expect(editor.selection.ids).toEqual(['entity:crate/crate1'])
    expect(editor.view.state.camera).toEqual({ x: 20, z: 20, zoom: 2 })
    panel.locate({ selection: 'entity:crate/crate1', at: { x: 11, z: 2 } })
    expect(editor.view.state.camera).toEqual({ x: 11, z: 2, zoom: 2 })
  })

  it('refuses a room or a wall that is no longer in the level, and changes nothing', () => {
    const { editor, panel } = located()
    editor.selection.set(['sector:hall'])
    editor.run({
      id: 'test.drop',
      label: 'Drop the dock',
      run: (profile, level) =>
        ok(
          profile.sectors.withSectors(
            level,
            profile.sectors.list(level).filter((sector) => sector.id !== 'dock'),
          ),
        ),
    })
    const camera = editor.view.state.camera
    expect(panel.locate({ selection: 'sector:dock' })).toEqual({
      ok: false,
      reason: 'dock is not in the level any more',
    })
    expect(panel.locate({ selection: 'wall:dock/1' })).toEqual({
      ok: false,
      reason: 'dock is not in the level any more',
    })
    expect(panel.locate({ selection: 'wall:hall/9' })).toEqual({
      ok: false,
      reason: 'wall 9 of hall is not in the level any more',
    })
    expect(editor.selection.ids).toEqual(['sector:hall'])
    expect(editor.view.state.camera).toBe(camera)
  })

  it('refuses a problem with no place, and an id that is no selection id, naming it', () => {
    const { editor, panel } = located()
    expect(panel.locate(undefined)).toEqual({ ok: false, reason: 'that problem has no place in the level' })
    expect(panel.locate({ selection: 'hall' })).toEqual({
      ok: false,
      reason: '"hall" is not a place in the level',
    })
    expect(editor.selection.ids).toEqual([])
  })

  it('finds the room of a real problem end to end', () => {
    const { editor, panel } = located()
    editor.run(breakHall)
    panel.run()
    const heights = panel.view.results.find((each) => each.id === 'heights')
    const room = heights?.problems[0]
    expect(room?.message).toBe('hall: the ceiling (-1 m) is not above the floor (0 m)')
    expect(panel.locate(room?.locator)).toEqual({ ok: true })
    expect(editor.selection.ids).toEqual(['sector:hall'])
    expect(editor.view.state.camera).toMatchObject({ x: 4, z: 3 })
    const portal = heights?.problems[1]
    panel.locate(portal?.locator)
    expect(editor.selection.ids).toEqual(['wall:hall/1'])
    expect(editor.view.state.camera).toMatchObject({ x: 8, z: 0 })
  })
})
