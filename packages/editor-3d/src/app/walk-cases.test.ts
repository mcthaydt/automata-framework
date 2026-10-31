// Acceptance cases of the Walk view (ED3D.8b; ED3D spec §13): ED3-f (tap a wall in Walk, make it a window, look at Plan: the
// window is there and one undo reverts both views), ED3-n (a level with no spawn: Walk starts in the first sector with
// a warning) and ED3-s (draw a rectangle against the depot's hall wall, accept the portal, walk through it; the
// generic checks pass and Last Light's rules are not listed). The depot is the shipped sample `af-sector/1` level.
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { wallPortal } from '../model/portal-offers'
import { addSector } from '../model/sector-edits'
import { setWallKind } from '../model/wall-edits'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { planScene } from '../view/plan/plan-scene'
import { createWalkController } from '../view/walk/walk-controller'
import { createChecksPanel } from './checks-panel-controller'
import { createGeometryCache } from './geometry-cache'
import { createInspectorEdits } from './inspector-edits'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const CANVAS = { w: 800, h: 600 }
const editorOf = () => createLevelEditor({ profile: afSectorProfile, level: depot })

/** What the plan draws for a wall of a sector, by its kind. */
const planKindOf = (
  editor: ReturnType<typeof editorOf>,
  sector: string,
  corner: number,
): string | undefined => {
  const { layers, select } = createGeometryCache(editor)()
  return planScene(layers, select).walls.find((wall) => wall.selection === `wall:${sector}/${corner}`)?.kind
}

describe('ED3-f: a wall set to a window in Walk shows on the plan, and one undo reverts both', () => {
  it('picks the hall’s south wall from the spawn, makes it a window, and undoes both views in one step', () => {
    const editor = editorOf()
    const walk = createWalkController(editor, CANVAS)
    // The depot's spawn faces south, along the hall: the crosshair is on the hall's solid south wall.
    expect(walk.view.aim?.selection).toBe('wall:hall/2')
    walk.pick()
    expect(editor.selection.ids).toEqual(['wall:hall/2'])
    expect(planKindOf(editor, 'hall', 2)).toBe('solid')
    const meshBefore = walk.mesh

    const result = createInspectorEdits(editor).change(
      { kind: 'wall', sector: 'hall', corner: 2, type: 'window' },
      'set',
    )
    expect(result).toBeUndefined()
    expect(planKindOf(editor, 'hall', 2)).toBe('window')
    expect(walk.mesh).not.toBe(meshBefore)
    expect(walk.mesh.surfaces.length).toBeGreaterThan(meshBefore.surfaces.length - 1)

    editor.history.undo()
    expect(planKindOf(editor, 'hall', 2)).toBe('solid')
    expect(editor.history.canUndo).toBe(false)
  })
})

describe('ED3-n: a level with no spawn', () => {
  it('starts Walk in the middle of the first sector with a warning', () => {
    const level: AfSector = {
      ...depot,
      entities: depot.entities?.filter((thing) => thing['def'] !== 'spawn'),
    }
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    const walk = createWalkController(editor, CANVAS)
    expect(walk.view.warning).toMatch(/no spawn/)
    expect(walk.view.sector).toBe('hall')
  })
})

describe('ED3-s: a rectangle against the hall’s wall, its portal accepted, walked through', () => {
  it('writes both portals, crosses at the portal, passes the generic checks and lists no Last Light rule', () => {
    const editor = editorOf()
    expect(
      editor.run(
        addSector({
          id: 'annex',
          corners: [
            [0, 6],
            [8, 6],
            [8, 10],
            [0, 10],
          ],
          like: 'hall',
        }),
      ).ok,
    ).toBe(true)
    const offer = wallPortal(editor.profile, editor.level, 'annex', 0)
    if (offer.kind !== 'offer') throw new Error(`no portal offered: ${offer.kind}`)
    const made = editor.run(setWallKind({ sector: 'annex', corner: 0, kind: 'portal', to: offer.offer.to }))
    expect(made.ok ? '' : made.reason).toBe('')
    expect(wallPortal(editor.profile, editor.level, 'annex', 0)).toEqual({ kind: 'done', to: 'hall' })
    expect(wallPortal(editor.profile, editor.level, 'hall', 2)).toEqual({ kind: 'done', to: 'annex' })

    const walk = createWalkController(editor, CANVAS)
    walk.key('KeyW', true)
    for (let step = 0; step < 40; step++) walk.tick(0.1)
    expect(walk.view.sector).toBe('annex')
    expect(walk.view.camera.eye[2]).toBeGreaterThan(6)

    const panel = createChecksPanel(editor, { schedule: () => () => {} })
    panel.run()
    expect(panel.view.errors).toBe(0)
    const ids = panel.view.results.map((result) => result.id)
    expect(ids).toEqual(expect.arrayContaining(['shared-walls', 'openings', 'overlap', 'heights']))
    expect(ids.filter((id) => /nav|zone|camera|door-box/.test(id))).toEqual([])
  })
})
