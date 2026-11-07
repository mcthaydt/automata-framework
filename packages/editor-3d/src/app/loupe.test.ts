// The loupe the canvas hands the renderer (ED3D.6g-b step 7): nothing while the tool has no loupe point; otherwise the
// plan and the tool's overlay for a camera centred on the point at four times the zoom, in a 140 px lens placed clear of
// the point. The depot, 800 by 400 px, camera at (7, 3), zoom 1 (32 px a metre).

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { loupeOf, nudgePadOf } from './loupe'
import { createPlanPicture } from './plan-picture'
import { createPlanTools } from './plan-tools'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()
const SIZE = { w: 800, h: 400 }

function setup() {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
  const tools = createPlanTools(editor, SIZE)
  return { editor, tools, picture: createPlanPicture(editor) }
}

describe('loupeOf', () => {
  it('is nothing for Select, or a Sector tool with no loupe point', () => {
    const { editor, tools, picture } = setup()
    expect(loupeOf(editor, tools.state, SIZE, picture)).toBeUndefined()
    tools.choose('polygon')
    tools.hover({ x: 200, y: 100, kind: 'mouse' })
    expect(loupeOf(editor, tools.state, SIZE, picture)).toBeUndefined()
  })

  it('magnifies the plan around the snapped point under a Pencil, in a lens clear of it', () => {
    const { editor, tools, picture } = setup()
    tools.choose('polygon')
    // (2, 2) in the hall is at (400 - 5 × 32, 200 - 32) = (240, 168) on the canvas; above it there is no room for the
    // lens, so it sits below and right of the point.
    tools.hover({ x: 240, y: 168, kind: 'pen' })
    const loupe = loupeOf(editor, tools.state, SIZE, picture)
    expect(loupe).toMatchObject({ x: 296, y: 224, size: 140 })
    // The hall's fill fills the lens's middle: its corner (0, 0) is 2 m, 256 px, up and left of the middle.
    expect(loupe?.paint.fills[0]?.points.slice(0, 2)).toEqual([-186, -186])
    expect(loupe?.tool?.dots.some((dot) => dot.at.x === 70 && dot.at.y === 70)).toBe(true)
  })

  it('places the nudge pad while corners are placed with touch or a Pencil, and not with a mouse', () => {
    const { editor, tools } = setup()
    tools.choose('polygon')
    expect(nudgePadOf(editor, tools, SIZE)).toBeUndefined()
    tools.tap({ x: 240, y: 168, kind: 'mouse' })
    expect(nudgePadOf(editor, tools, SIZE)).toBeUndefined()
    tools.tap({ x: 272, y: 168, kind: 'pen' })
    expect(nudgePadOf(editor, tools, SIZE)).toBe('right')
    tools.tap({ x: 272, y: 200, kind: 'touch' })
    expect(nudgePadOf(editor, tools, SIZE)).toBe('right')
  })
})
