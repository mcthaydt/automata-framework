import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../../model/level-editor'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import { planToolsOf } from './plan-tools-of'

// The suite's Plan view keeps one set of tools per level editor (plan ED3D.6g-a), so a switch away and back finds the
// same tool and camera handling, as the editor keeps its own state.

describe('planToolsOf', () => {
  it('gives the same tools for the same editor, on Select, and new ones for another editor', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    const tools = planToolsOf(editor)
    expect(planToolsOf(editor)).toBe(tools)
    expect(tools.state.tool).toBe('select')
    const other = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    expect(planToolsOf(other)).not.toBe(tools)
  })
})
