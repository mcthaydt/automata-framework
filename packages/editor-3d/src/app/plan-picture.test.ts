import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { PLAN_COLORS } from '../view/plan/plan-colors'
import { createPlanPicture, planPointAt, planZoom } from './plan-picture'

// The editor's plan as a paint list (plan ED3D.5d step 5): what the canvas draws follows the level, the selection, the
// hidden layers and the camera, and the same level is not built twice.

const SIZE = { w: 640, h: 480 }

describe('createPlanPicture', () => {
  it('paints the level at the camera, with what is selected outlined', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
    const picture = createPlanPicture(editor)
    const before = picture(SIZE)
    expect(before.fills.map((fill) => fill.sector)).toEqual(['hall', 'dock'])
    // The camera looks at (7, 3) at 32 px a metre: the hall's first corner is at (96, 144).
    expect(before.fills[0]?.points.slice(0, 2)).toEqual([96, 144])
    editor.selection.set(['sector:hall'])
    expect(picture(SIZE).fills[0]?.selected).toBe(true)
    expect(picture(SIZE).walls.some((wall) => wall.color === PLAN_COLORS.accent)).toBe(true)
  })

  it('leaves out what the view hides', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    editor.view.set({ hidden: ['walls'] })
    const picture = createPlanPicture(editor)
    expect(picture(SIZE).walls).toEqual([])
    expect(picture(SIZE).fills).toHaveLength(2)
  })

  it('paints the things of a level that has them', () => {
    const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!parsed.ok) throw new Error('the depot does not parse')
    const editor = createLevelEditor({ profile: afSectorProfile, level: parsed.value })
    const kit = afSectorProfile.entities(parsed.value)
    expect(createPlanPicture(editor)(SIZE).things).toHaveLength(
      kit.things.filter((thing) => kit.definitions.some((definition) => definition.id === thing.def)).length,
    )
  })
})

describe('planZoom and planPointAt', () => {
  it('reads the camera in pixels per metre, held to the plan’s limits', () => {
    expect(planZoom({ x: 0, z: 0, zoom: 1.5 })).toBe(48)
    expect(planZoom({ x: 0, z: 0, zoom: 100 })).toBe(400)
  })

  it('says which plan point a canvas pixel shows', () => {
    expect(planPointAt({ x: 7, z: 3, zoom: 1 }, SIZE, { x: 96, y: 144 })).toEqual({ x: 0, z: 0 })
  })
})
