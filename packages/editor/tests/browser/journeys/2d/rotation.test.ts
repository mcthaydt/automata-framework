import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { IPAD_PROFILES, turned } from '#src/testing/kit/ipad-profiles.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { createPointers } from '#src/testing/kit/pointers.ts'
import {
  cellAt,
  chooseLayer,
  type JourneyEditor,
  named,
  openJourneyEditor,
} from '#src/testing/level-2d/journey-editor.ts'

// ED2D.8 journey: the iPad turns during a Pencil stroke. iPadOS cancels the touches in flight,
// so the stroke is cancelled with nothing half-painted, the canvas is the same element (no remount), and the chosen
// layer and tool are kept.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

describe.each(IPAD_PROFILES)('a rotation mid-stroke at $name', (profile) => {
  it('cancels the stroke without a half step, a remount or a lost selection', async () => {
    editor = await openJourneyEditor(profile, 'platformer')
    const open = editor
    await chooseLayer('Collision')
    const collision = document.querySelector<HTMLElement>(
      '[role="listbox"][aria-label="Layers"] [role="option"][aria-selected="true"]',
    )
    expect(collision?.querySelector('.label')?.textContent).toBe('Collision')

    const surface = open.surface()
    const start = open.project()
    const revision = open.document.history.revision
    const pen = await createPointers(surface).down('pen', cellAt(open, 3, 9))
    await pen.move(cellAt(open, 5, 9))
    await pen.move(cellAt(open, 7, 9))
    expect(open.project(), 'the stroke is open and showing').not.toBe(start)

    const quarter = turned(profile)
    await open.resize(quarter)
    await pen.cancel()
    await arrived()

    expect(open.project(), 'nothing half painted').toBe(start)
    expect(open.document.history.revision).toBe(revision)
    expect(open.document.history.canUndo).toBe(false)
    expect(open.surface(), 'the canvas was not remounted').toBe(surface)
    expect(collision?.getAttribute('aria-selected'), 'the layer stays chosen').toBe('true')
    expect(named('radio', 'Brush').getAttribute('aria-checked'), 'the tool stays chosen').toBe('true')
  })
})
