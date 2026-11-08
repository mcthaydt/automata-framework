import { describe, expect, it } from 'vitest'
import { planToolsOf } from '#src/features/levels-3d/plan-tools-of.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

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
